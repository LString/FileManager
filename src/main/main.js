const { app, BrowserWindow, ipcMain, dialog, Notification } = require('electron')
const path = require('path')
const DB = require('../database/initDB');
const AES256 = require('./encryption');
const { v4: uuidv4 } = require('uuid');
const { generateAndExport } = require('../pdf417/barcode-word-generator');


let mainWindow;
let loginWindow;
let dbInstance;
let aes256;
let currentAccount;//当前登录的用户
function createWindow() {
  // 打印预加载脚本路径用于验证
  console.log('预加载脚本路径:', path.resolve(__dirname, '../preload.js'))

  loginWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: true,
      sandbox: true,
      //允许加载模块
      webSecurity: process.env.NODE_ENV === 'development',
      experimentalFeatures: true
    }
  })

  // 加载页面时显示加载状态
  loginWindow.loadFile(path.join(__dirname, '../renderer/loginWindow/loginnew.html'))
    .then(() => console.log('页面加载完成'))
    .catch(err => console.error('页面加载失败:', err))

  // 调试模式
  // loginWindow.webContents.openDevTools()
}

function initAccount() { //初始化账户
  // 管理员账户
  let admin = 'admin'
  let admin_password = '123456'
  //普通用户
  let user = 'user'
  let user_password = '123456'
  const checkAdmin = dbInstance.statements.getAccount.get({ username: 'admin' })
  if (checkAdmin == null) {
    //创建管理员
    dbInstance.statements.createAccount.run(
      {
        username: admin,
        password: admin_password,
        level: 1
      }
    )
  }

  const checkUser = dbInstance.statements.getAccount.get({ username: 'user' })
  if (checkUser == null) {
    //创建普通用户
    dbInstance.statements.createAccount.run(
      {
        username: user,
        password: user_password,
        level: 2
      }
    )
  }

}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      //允许加载模块
      webSecurity: false,
      experimentalFeatures: true
    }
  })


  mainWindow.loadFile(path.join(__dirname, '../renderer/mainWindow/mainWindow.html'))
    .then(() => console.log('页面加载完成'))
    .catch(err => console.error('页面加载失败:', err))

  // 调试模式
  mainWindow.webContents.openDevTools()
}


// 监听登录成功事件
// ipcMain.on('login-success', (event, userData) => {
//   console.log('接受登录请求')
//   createMainWindow(); // 创建主窗口
//   loginWindow.close(); // 关闭登录窗口
// });

// IPC通信处理
ipcMain.on('minimize-window', () => {
  console.log('接收到最小化请求')
  // 使用可选链操作符和存在性检查
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.minimize()
  }

  // 主窗口可能尚未创建，添加严格判断
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize()
  }
})

ipcMain.on('maximize-window', () => {
  // 优先处理当前活动窗口
  const targetWindow = mainWindow || loginWindow

  if (targetWindow && !targetWindow.isDestroyed()) {
    targetWindow.isMaximized()
      ? targetWindow.unmaximize()
      : targetWindow.maximize()
  }
})

ipcMain.on('close-window', () => {
  console.log('接收到关闭请求')
    // 使用反向循环关闭所有窗口
    ;[loginWindow, mainWindow].forEach(win => {
      if (win && !win.isDestroyed()) {
        win.close()
      }
    })
})

ipcMain.handle('database', async (_, { action, data }) => {

  try {
    switch (action) {
      case 'login': {
        const account = dbInstance.statements.getAccount.get({ username: data.username })
        if (account == null) {
          showLoginInfo({
            message: "用户名或密码错误",
            showNotice: true
          })
          return
        }

        if (data.password != account.password) {
          showLoginInfo({
            message: "用户名或密码错误",
            showNotice: true
          })
          return
        }
        currentAccount = account;
        createMainWindow(); // 创建主窗口
        loginWindow.close(); // 关闭登录窗口
        return;
      }
      //新建普通文档
      case 'createDocument': {
        const uuid = uuidv4();
        const password = currentAccount.password
        aes256.init(password)
        const leadersEncrypt = data.review_leader.split(',').map(name => aes256.encrypt(name)).join(',')
        const lastRowId = dbInstance.statements.createDocument.run(
          {
            uuid: uuid,
            doc_type: data.doc_type,
            title: aes256.encrypt(data.title),
            sender_number: aes256.encrypt(data.sender_number),
            sender_date: aes256.encrypt(data.sender_date),
            sender_unit: aes256.encrypt(data.sender_unit),

            secrecy_level: aes256.encrypt(data.secrecy_level),
            secrecy_period: aes256.encrypt(data.secrecy_period),
            input_user: aes256.encrypt(currentAccount.username),

            drafting_unit: aes256.encrypt(data.drafting_unit),
            crgency_level: aes256.encrypt(data.crgency_level),
            review_leader: leadersEncrypt,
            remarks: aes256.encrypt(data.remarks)
          }).lastInsertRowid
        if (lastRowId && data.annotate.length > 0) {//如果有批注，创建完文件插入批注
          data.annotate.forEach(anno => {
            anno.uuid = uuid;
            dbInstance.statements.addAnnotation.run({
              annotate_type: anno.annotate_type,
              uuid: anno.uuid,
              content: aes256.encrypt(anno.content),
              processing_mode: anno.processing_mode,
              annotate_note: aes256.encrypt(anno.annotate_note),
              author_id: anno.authorId,
              annotate_at: anno.annotate_at,
              distribution_scope: aes256.encrypt(anno.distribution_scope),
              distribution_at: aes256.encrypt(anno.distribution_at),
            });
          })

        }
        if (lastRowId) {
          dbInstance.statements.logOperation.run(
            {
              operation_type: aes256.encrypt('创建'),
              table_name: aes256.encrypt('documents'),

              operator: aes256.encrypt(currentAccount.username),
              details: aes256.encrypt('创建文档《' + data.title + "》")
            }
          )
        }
        return lastRowId
      }

      //获取列表  
      case 'getDocumentsByTypeWithKeywords': {
        const password = currentAccount.password;
        aes256.init(password);

        const encryptedDocs = dbInstance.statements.getDocumentsByTypeWithKeywords.all({ doc_type: data });

        return encryptedDocs.map(doc => {

          let keywords = [];
          try {
            keywords = JSON.parse(doc.keywords);
          } catch (_e) {
            keywords = []; // 解析失败时返回空数组
          }

          // // 解密每个关键词
          // const decryptedKeywords = keywords.map(kw => ({
          //   id: kw.id,
          //   keyword: aes256.decrypt(kw.keyword), // 仅解密keyword字段
          //   create_time: kw.create_time // 时间字段无需解密
          // });

          return {
            id: doc.id,
            uuid: doc.uuid,
            created_at: doc.created_at,
            title: aes256.decrypt(doc.title),
            sender_unit: aes256.decrypt(doc.sender_unit),
            sender_number: aes256.decrypt(doc.sender_number),
            drafting_unit: aes256.decrypt(doc.drafting_unit),
            input_user: aes256.decrypt(doc.input_user),
            sender_date: aes256.decrypt(doc.sender_date),
            secrecy_level: aes256.decrypt(doc.secrecy_level),
            crgency_level: aes256.decrypt(doc.crgency_level),
            secrecy_period: aes256.decrypt(doc.secrecy_period),
            key_words: keywords,
            review_leader: doc.review_leader.split(',').map(leader => aes256.decrypt(leader)).join(','),
            remarks: aes256.decrypt(doc.remarks)
          }
        });
      }

      //获取表单信息
      case 'getDocumentById': {
        const encryptedDoc = dbInstance.statements.getDocumentById.get({ uuid: data });
        if (!encryptedDoc) return null;
        const password = currentAccount.password;
        aes256.init(password);
        return {
          uuid: encryptedDoc.uuid,
          title: aes256.decrypt(encryptedDoc.title),
          sender_unit: aes256.decrypt(encryptedDoc.sender_unit),
          sender_number: aes256.decrypt(encryptedDoc.sender_number),
          original_number: aes256.decrypt(encryptedDoc.original_number),
          drafting_unit: aes256.decrypt(encryptedDoc.drafting_unit),
          review_leader: aes256.decrypt(encryptedDoc.review_leader),
          secrecy_level: aes256.decrypt(encryptedDoc.secrecy_level),
          crgency_level: aes256.decrypt(encryptedDoc.crgency_level),
          secrecy_period: aes256.decrypt(encryptedDoc.secrecy_period),
          created_at: encryptedDoc.created_at,
        };
      }
      //更新列表
      case 'updateDocument':
        return dbInstance.connection.transaction(() => {

          dbInstance.statements.deleteAllDocKeywords.run({ docId: data.id });
          let popKeywords = data.key_words

          // 2. 添加新关联
          for (const kw of popKeywords) {
            let keywordId = kw.id;

            // 如果是新增关键词（id=0）
            if (keywordId === 0) {
              // 创建新关键词
              // const encrypted = aes256.encrypt(kw.keyword);
              const response = dbInstance.statements.createKeyWord.get({ keyword: kw.keyword });
              if (response) keywordId = response.id;
            }

            // 添加关联
            if (keywordId > 0) {
              dbInstance.statements.addDocKeyword.run({
                docId: data.id,
                keywordId: keywordId
              });
            }
          }

          const password = currentAccount.password
          aes256.init(password)
          const result = dbInstance.statements.updateDocument.run({
            title: aes256.encrypt(data.title),
            sender_number: aes256.encrypt(data.sender_number),
            sender_date: aes256.encrypt(data.sender_date),
            sender_unit: aes256.encrypt(data.sender_unit),
            secrecy_level: aes256.encrypt(data.secrecy_level),
            secrecy_period: aes256.encrypt(data.secrecy_period),
            crgency_level: aes256.encrypt(data.crgency_level),
            drafting_unit: aes256.encrypt(data.drafting_unit),
            review_leader: data.review_leader.split(',').map(leader => aes256.encrypt(leader)).join(','),
            remarks: aes256.encrypt(data.remarks),
            uuid: data.uuid
          });

          if (result.changes > 0) {
            dbInstance.statements.logOperation.run(
              {
                operation_type: aes256.encrypt('更新'),
                table_name: aes256.encrypt('documents'),

                operator: aes256.encrypt(currentAccount.username),
                details: aes256.encrypt('更新文档《' + data.title + "》")
              }
            )
          }
          return { success: result.changes > 0 };
        })();

      //删除列表
      case 'deleteDocument':
        console.log('删除操作UUID:', data);
        return dbInstance.connection.transaction(() => {
          const result = dbInstance.statements.deleteDocument.run({ uuid: data.uuid });
          console.log('删除影响行数:', result.changes);

          if (result.changes > 0) {
            dbInstance.statements.logOperation.run(
              {
                operation_type: aes256.encrypt('删除'),
                table_name: aes256.encrypt('documents'),

                operator: aes256.encrypt(currentAccount.username),
                details: aes256.encrypt('删除文档《' + data.title + "》")
              }
            )
          }
          return { success: result.changes > 0 };
        })();

      //转为重要文件
      case 'convertToImportant': {
        const uuid = dbInstance.convertToImportant(data);
        if (uuid) {
          dbInstance.statements.logOperation.run(
            {
              operation_type: aes256.encrypt('转重要'),
              table_name: aes256.encrypt('documents'),

              operator: aes256.encrypt(currentAccount.username),
              details: aes256.encrypt('转为重要文档')
            }
          )
        }
        return uuid
      }

      //添加批注
      case 'addAnnotation': {
        const password = currentAccount.password;
        aes256.init(password);
        const uuid = dbInstance.statements.addAnnotation.run(
          {
            annotate_type: data.annotate_type,
            uuid: data.uuid,
            content: aes256.encrypt(data.content),
            processing_mode: data.processing_mode,
            annotate_note: aes256.encrypt(data.annotate_note),
            author_id: data.authorId,
            annotate_at: data.annotate_at,
            distribution_scope: aes256.encrypt(data.distribution_scope),
            distribution_at: aes256.encrypt(data.distribution_at),
          });

        if (uuid) {
          dbInstance.statements.logOperation.run(
            {
              operation_type: aes256.encrypt('新建'),
              table_name: aes256.encrypt('annotations'),

              operator: aes256.encrypt(currentAccount.username),
              details: aes256.encrypt('新建批注')
            }
          )
        }
        return uuid;

      }

      //获取批注列表
      case 'getAnnotations': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedAnnotations = dbInstance.statements.getAnnotations.all({
          uuid: data.uuid
        });

        return encryptedAnnotations.map(anno => {
          const baseData = {
            id: anno.id,
            processing_mode: anno.processing_mode,
            created_at: anno.created_at,
            annotate_at: anno.annotate_at
          };

          return {
            ...baseData,
            content: aes256.decrypt(anno.content),
            annotate_note: aes256.decrypt(anno.annotate_note),
            author: aes256.decrypt(anno.author_name),
            distribution_scope: aes256.decrypt(anno.distribution_scope),
            distribution_at: aes256.decrypt(anno.distribution_at)
          };
        });
      }
      case 'updateAnnotate': {
        const password = currentAccount.password;
        aes256.init(password);
        const id = dbInstance.statements.updateAnnotate.run(
          {
            annotation_id: data.id,
            annotate_type: data.annotate_type,
            uuid: data.uuid,
            content: aes256.encrypt(data.content),
            processing_mode: data.processing_mode,
            annotate_note: aes256.encrypt(data.annotate_note),
            author_id: data.authorId,
            annotate_at: data.annotate_at,
            distribution_scope: aes256.encrypt(data.distribution_scope),
            distribution_at: aes256.encrypt(data.distribution_at),
          }
        );
        if (id) {
          dbInstance.statements.logOperation.run(
            {
              operation_type: aes256.encrypt('更新'),
              table_name: aes256.encrypt('annotations'),
              operator: aes256.encrypt(currentAccount.username),
              details: aes256.encrypt('更新批注')
            }
          )
        }
        return id;
      }

      case 'deleteAnnotate': {
        const annoId = dbInstance.statements.deleteAnnotate.run({ id: data });
        if (annoId) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('annotations'),
              operation_type: aes256.encrypt('删除'),
              operator: aes256.encrypt(currentAccount.username),
              details: aes256.encrypt('删除批注')
            }
          )
        }
        return annoId;
      }

      case 'deleteAnnotates': {
        return dbInstance.statements.deleteAnnotates.run({ group_ids: data });
      }

      // 作者管理相关操作
      case 'findAuthorsByName': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedName = aes256.encrypt(data);
        return dbInstance.statements.findAuthorsByName.all({ name: encryptedName });
      }

      case 'createAuthor': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedName = aes256.encrypt(data.name);
        const encryptedUnit = aes256.encrypt(data.unit);
        const result = dbInstance.statements.createAuthor.get({ name: encryptedName, unit: encryptedUnit });
        if (result) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('authors'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('新建'),
              details: aes256.encrypt('新建姓名 - ' + data.name)
            }
          )
        }
        return result.id;
      }

      case 'createAuthors': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryName = data.map(name => aes256.encrypt(name))
        const result = dbInstance.createAuthors(encryName);
        if (result) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('authors'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('新建'),
              details: aes256.encrypt('新建姓名 - ' + data)
            }
          )
        }
        return result;
      }


      case 'addAuthorAlias': {
        const password = currentAccount.password;
        aes256.init(password);
        const aliaId = dbInstance.statements.addAuthorAlias.run({
          author_id: data.author_id,
          alias: aes256.encrypt(data.alias)
        }).lastInsertRowid;
        if (aliaId) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('新建'),
              details: aes256.encrypt('新建姓名别名,' + data.author_name + "-" + data.alias)
            }
          )
        }
        return aliaId
      }

      case 'getAuthors': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedData = dbInstance.statements.getAuthors.all();

        return encryptedData.map(item => ({
          authorId: item.id,
          name: aes256.decrypt(item.name)
        }));
      }

      case 'getAuthorsWithAliases': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedData = dbInstance.statements.getAuthorsWithAliases.all();

        return encryptedData.map(item => {
          try {
            // 解密作者名称
            const decryptedName = aes256.decrypt(item.name);

            // 处理 aliases 字段（可能是字符串或对象）
            let aliases;
            if (typeof item.aliases === 'string') {
              // 如果是字符串，解析为 JSON 数组
              aliases = JSON.parse(item.aliases);
            } else {
              // 如果是对象，直接使用（兼容驱动自动解析的情况）
              aliases = item.aliases || [];
            }

            // 解密每个别名
            const decryptedAliases = aliases.map(alias => ({
              id: alias.id,
              alias: aes256.decrypt(alias.alias) // 解密别名
            }));

            // 揭秘单位名
            const decryptedUnitName = aes256.decrypt(item.unit)

            return {
              authorId: item.authorId,
              name: decryptedName,
              aliases: decryptedAliases,
              unit_name: decryptedUnitName
            };

          } catch (error) {
            console.error('处理作者数据时发生错误:', error);
            // 返回错误占位信息，避免阻塞整个列表
            return {
              authorId: item.authorId,
              name: '[解密失败]',
              aliases: []
            };
          }
        });
      }

      case 'deleteAuthor':

        return dbInstance.connection.transaction(() => {
          dbInstance.statements.deleteAuthor.run({ authorId: data });
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('authors'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('删除'),
              details: aes256.encrypt('删除姓名' + data)
            }
          )
          return { changes: 1 };
        })();

      case 'deleteAlias': {
        const change = dbInstance.statements.deleteAlias.run({ aliasId: data }).changes
        if (change) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('删除'),
              details: aes256.encrypt('删除别名' + data)
            }
          )
        }
        return change;
      }

      case 'searchAuthors': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedQuery = aes256.encrypt(`%${data}%`);
        const results = dbInstance.statements.searchAuthors.all({ query: encryptedQuery });

        return results.map(item => ({
          ...item,
          name: aes256.decrypt(item.name),
          aliases: item.aliases ? item.aliases.split(',').map(a => aes256.decrypt(a)) : []
        }));
      }

      case 'updateAuthor': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryName = aes256.encrypt(data.newName);
        const encryUnit = aes256.encrypt(data.newUnit);
        //对别名分别加密
        const encryAliases = data.newAliases?.length > 0
          ? data.newAliases.map(item => aes256.encrypt(item))
          : [];
        const id = dbInstance.updateAuthor({
          authorId: data.authorId,
          newName: encryName,
          newUnit: encryUnit,
          newAliases: encryAliases,
          deleteAliasIds: data.deleteAliasIds
        });

        if (id) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('更新'),
              details: aes256.encrypt('更新别名' + data.newName)
            }
          )
        }
        return id;
      }

      //单位管理
      case 'findUnitByName': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedName = aes256.encrypt(data);
        return dbInstance.statements.findUnitByName.all({ name: encryptedName });
      }

      case 'createUnit': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedName = aes256.encrypt(data.name);
        const result = dbInstance.statements.createUnit.get({ name: encryptedName });
        if (result) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('创建'),
              details: aes256.encrypt('创建单位' + data.name)
            }
          )
        }
        return result.id;
      }

      case 'addUnitSon': {
        const password = currentAccount.password;
        aes256.init(password);
        const result = dbInstance.statements.addUnitSon.run({
          unit_id: data.unit_id,
          unit_son_name: aes256.encrypt(data.unit_son_name)
        }).lastInsertRowid;
        if (result) {
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('创建'),
              details: aes256.encrypt('创建单位' + data.unit_son_name)
            }
          )
        }
        return result;
      }

      case 'getUnits': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedData = dbInstance.statements.getUnits.all();

        return encryptedData.map(item => ({
          unitId: item.id,
          name: aes256.decrypt(item.name)
        }));
      }

      case 'getUnitWithSon': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedData = dbInstance.statements.getUnitWithSon.all();

        return encryptedData.map(item => {
          try {
            // 解密作者名称
            const decryptedName = aes256.decrypt(item.name);

            // 处理 aliases 字段（可能是字符串或对象）
            let unitSon;
            if (typeof item.unitsSon === 'string') {
              // 如果是字符串，解析为 JSON 数组
              unitSon = JSON.parse(item.unitsSon);
            } else {
              // 如果是对象，直接使用（兼容驱动自动解析的情况）
              unitSon = item.unitsSon || [];
            }

            // 解密每个子名字
            const decryptedUnitSon = unitSon.map(unitson => ({
              id: unitson.id,
              unit_son_name: aes256.decrypt(unitson.unit_son_name) // 解密别名
            }));

            return {
              unitId: item.unitId,
              name: decryptedName,
              unitSons: decryptedUnitSon
            };

          } catch (error) {
            console.error('处理作者数据时发生错误:', error);
            // 返回错误占位信息，避免阻塞整个列表
            return {
              unitId: item.id,
              name: '[解密失败]',
              unitSons: []
            };
          }
        });
      }
      case 'getUnitWithSonToManager': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedData = dbInstance.statements.getUnitWithSonToManager.all();

        // 创建缓存避免重复解密主单元名称
        const unitNameCache = new Map();

        return encryptedData.map(item => {
          try {
            // 缓存解密后的主单元名称
            if (!unitNameCache.has(item.unitId)) {
              unitNameCache.set(item.unitId, aes256.decrypt(item.name));
            }

            // 处理每个子单元条目
            return {
              unitId: item.unitId,
              name: unitNameCache.get(item.unitId),
              unitSon: {
                id: item.sonId,
                unit_son_name: aes256.decrypt(item.sonName)
              }
            };

          } catch (error) {
            console.error('数据处理失败:', error);
            return {
              unitId: item.unitId,
              name: '[解密失败]',
              unitSon: {
                id: item.sonId,
                unit_son_name: '[解密失败]'
              }
            };
          }
        });

      }
      case 'deleteUnit':
        return dbInstance.connection.transaction(() => {
          dbInstance.statements.deleteUnit.run({ unitId: data });
          dbInstance.statements.logOperation.run(
            {
              table_name: aes256.encrypt('author_alias'),
              operator: aes256.encrypt(currentAccount.username),
              operation_type: aes256.encrypt('创建'),
              details: aes256.encrypt('删除单位' + data)
            }
          )

          return { changes: 1 };
        })();

      case 'deleteUnitSon': {
        const changes = dbInstance.statements.deleteUnitSon.run({ unitSonId: data }).changes;
        dbInstance.statements.logOperation.run(
          {
            table_name: aes256.encrypt('unit'),
            operator: aes256.encrypt(currentAccount.username),
            operation_type: aes256.encrypt('删除'),
            details: aes256.encrypt('删除单位' + data)
          }
        )
        return changes;
      }


      case 'searchUnit': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryptedQuery = aes256.encrypt(`%${data}%`);
        const results = dbInstance.statements.searchUnit.all({ query: encryptedQuery });

        return results.map(item => ({
          ...item,
          name: aes256.decrypt(item.name),
          aliases: item.aliases ? item.aliases.split(',').map(a => aes256.decrypt(a)) : []
        }));
      }

      case 'updateUnitWithSons': {
        const password = currentAccount.password;
        aes256.init(password);
        const encryUnit = aes256.encrypt(data.newName);
        //对别名分别加密
        const encryUnitSons = data.newUnitSons?.length > 0
          ? data.newUnitSons.map(item => {
            let result = {
              sonId: item.currentUnitSonId,
              newSonName: aes256.encrypt(item.newUnitSonName)
            }
            return result
          })
          : [];
        let changes = dbInstance.updateUnitWithSons(
          data.unitId,
          encryUnit,
          encryUnitSons,
        );
        dbInstance.statements.logOperation.run(
          {
            table_name: aes256.encrypt('unit-unitson'),
            operator: aes256.encrypt(currentAccount.username),
            operation_type: aes256.encrypt('更新'),
            details: aes256.encrypt('更新单位' + data.newName)
          }
        )
        return changes
      }

      case 'getOperations': {
        const password = currentAccount.password;
        aes256.init(password);
        const auditList = dbInstance.statements.getOperations.all();
        const auditListEncrypt = auditList.map(audit => ({
          operation_time: audit.operation_time,
          operator: aes256.decrypt(audit.operator),
          details: aes256.decrypt(audit.details)
        }))
        return auditListEncrypt
      }

      case 'getKeyWords': {
        const encryptedData = dbInstance.statements.getKeyWords.all();
        return encryptedData
      }

      case 'getKeyWordsAll': {
        const encryptedData = dbInstance.statements.getKeyWordsAll.all();
        return encryptedData
      }

      case 'createKeyWords': {//暂时不加密
        // const password = currentAccount.password;
        // aes256.init(password);
        // const encryWords = data.map(words => aes256.encrypt(words))
        const result = dbInstance.createKeyWords(data);
        if (result.length > 0) {
          return result;
        }
        return [];
      }

      case 'linkDocKeywords': {
        // const password = currentAccount.password;
        // aes256.init(password);
        // const encryWords = data.map(words => aes256.encrypt(words))
        const result = dbInstance.linkDocKeywords(data.doc_id, data.keyword_ids);
        if (result.length > 0) {
          return result;
        }
        return [];
      }

      case 'deleteAllDocKeywords': {
        const { docId } = data;
        return dbInstance.statements.deleteAllDocKeywords.run({ docId });
      }

      case 'addDocKeyword': {
        const { docId, keywordId } = data;
        return dbInstance.statements.addDocKeyword.run({ docId, keywordId });
      }

      case 'createKeyWord': {
        const password = currentAccount.password;
        aes256.init(password);

        const encrypted = aes256.encrypt(data.keyword);
        return dbInstance.statements.createKeyWord.get({ keyword: encrypted });
      }

      // 在IPC通信处理中添加以下case
      case 'getDocumentsByKeywordId': {
        const keywordId = data;
        const encryptedDocs = dbInstance.statements.getDocumentsByKeywordId.all({ keywordId });

        if (!encryptedDocs || encryptedDocs.length === 0) {
          return [];
        }

        const password = currentAccount.password;
        aes256.init(password);

        return encryptedDocs.map(doc => ({
          id: doc.id,
          uuid: doc.uuid,
          title: aes256.decrypt(doc.title) // 解密文档标题
        }));
      }

      default:
        throw new Error('未知的数据库操作');
    }
  } catch (error) {
    console.error('数据库操作失败:', error);
    throw error;
  }
})

// ipcMain.handle('store', async (_, { action, data }) => {

//   try {
//     switch (action) {
//       //
//       case 'saveCredentials': {
//         return storeManager.saveCredentials(data.username, data.password, data.rememberMe);
//       }

//       case 'getCredentials':
//         return storeManager.getCredentials();


//       case 'clearCredentials':
//         return storeManager.clearCredentials();

//       default:
//         throw new Error('未知的数据库操作');
//     }
//   } catch (error) {
//     console.error('数据库操作失败:', error);
//     throw error;
//   }
// })

const fs = require('fs').promises

ipcMain.handle('read-config', async () => {
  try {
    const configPath = path.join(app.getAppPath(), 'form-options.json')
    console.log('最终配置文件路径:', configPath)
    return await fs.readFile(configPath, 'utf8')
  } catch (error) {
    console.error('配置文件读取失败:', error)
    throw error
  }
})
ipcMain.handle('getLevel', async () => {
  return currentAccount.level
})
ipcMain.handle('getCurrentAcconutName', async () => {
  return currentAccount.username
})

ipcMain.handle('get-cascader-data', async () => {
  try {
    // 示例数据，实际应从数据库或配置文件获取
    try {
      const configPath = path.join(app.getAppPath(), 'form-annotate.json')
      console.log('最终配置文件路径:', configPath)
      return await fs.readFile(configPath, 'utf8')
    } catch (error) {
      console.error('配置文件读取失败:', error)
      throw error
    }
  } catch (error) {
    console.error('获取级联数据失败:', error)
    throw error
  }
})

ipcMain.handle('show-save-dialog', async (event, options) => {
  return dialog.showSaveDialogSync({
    title: options.title || '保存文件',
    defaultPath: options.defaultPath || '未命名文档.docx',
    filters: options.filters || [{ name: 'Word 文档', extensions: ['docx'] }]
  });
});

ipcMain.handle('save-document', async (event, params) => {
  try {

    const {
      text,
      outputPath,
      title = "默认标题",
      imageWidth = 400
    } = params || {};


    // 参数结构验证
    if (!text || typeof text !== 'string') {
      throw new Error("条码内容不能为空");
    }

    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error("无效的输出路径");
    }


    // 调用工具类生成文档
    const resultPath = await generateAndExport(
      {
        text: text,
        outputPath: outputPath,
        title: title,
        imageWidth: imageWidth
      }
    );

    return { success: true, path: resultPath }
  } catch (error) {
    console.error('文档生成失败:', error);
    throw new Error(`文档生成失败: ${error.message}`);
  }
});

ipcMain.handle('save-config', async (_, { type, data }) => {
  try {
    const filename = type === 'form-options'
      ? 'form-options.json'
      : 'form-annotate.json';

    const configPath = path.join(app.getAppPath(), filename);
    await fs.writeFile(configPath, JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('配置保存失败:', error);
    throw error;
  }
});

ipcMain.handle('dialog:show', (event, action) => {
  return new Promise((resolve) => {
    const customDialog = new BrowserWindow({
      width: 464,
      height: 209,
      parent: mainWindow,
      modal: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: true,
        sandbox: true,
      }
    });
    //传递参数
    customDialog.webContents.on('did-finish-load', () => {
      customDialog.webContents.send('dialog-options', action);
    });

    customDialog.loadFile(path.join(__dirname, '../renderer/dialog/dialog.html'))
      .then(() => console.log('页面加载完成'))
      .catch(err => console.error('页面加载失败:', err));
    // 调试模式
    // customDialog.webContents.openDevTools()

    // 监听子窗口的响应事件
    ipcMain.once('dialog:response', (_, response) => {
      customDialog.destroy(); // 关闭对话框
      resolve(response.action); // 返回结果到调用方
    });

    // // 处理窗口意外关闭
    // customDialog.on('closed', () => {
    //   resolve('closed');
    // });
  });
});
ipcMain.handle('toast:show', (event, data) => {
  new Notification({
    title: '系统提示',
    body: data,
    silent: true // 静音模式
  }).show();
});



function showLoginInfo(action) {
  const customDialog = new BrowserWindow({
    width: 464,
    height: 209,
    parent: loginWindow,
    modal: true,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: true,
      sandbox: true,
    }
  });
  //传递参数
  customDialog.webContents.on('did-finish-load', () => {
    customDialog.webContents.send('dialog-options', action);
  });

  customDialog.loadFile(path.join(__dirname, '../renderer/dialog/dialog.html'))
    .then(() => console.log('页面加载完成'))
    .catch(err => console.error('页面加载失败:', err));

  // 监听子窗口的响应事件
  ipcMain.once('dialog:response', (_, response) => {
    customDialog.destroy(); // 关闭对话框
  });
}

app.whenReady().then(() => {
  console.log('应用准备就绪')
  dbInstance = new DB();
  // storeManager = new StoreManager();
  aes256 = new AES256();
  initAccount()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})