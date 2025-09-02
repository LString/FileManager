const { contextBridge, ipcRenderer } = require('electron')
// 暴露安全API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  showDialog: (action) => ipcRenderer.invoke('dialog:show', action),
  showToast: (data) => ipcRenderer.invoke('toast:show', data),
  receiveConfig: (callback) => {
    ipcRenderer.on('dialog-options', (event, action) => callback(action));
  },
  saveConfig: () => {
    ipcRenderer.send('save-config')
  },
  minimize: () => {
    console.log('[Preload] 发送最小化请求')
    ipcRenderer.send('minimize-window')
  },
  maximize: () => {
    console.log('[Preload] 发送最大化请求')
    ipcRenderer.send('maximize-window')
  },
  close: () => {
    console.log('[Preload] 发送关闭请求')
    ipcRenderer.send('close-window')
  },
  logout: () => {
    ipcRenderer.send('logout')
  },
  onMaximized: (callback) => {
    ipcRenderer.on('window-maximized', callback)
    return () => ipcRenderer.removeListener('window-maximized', callback)
  },
  onUnmaximized: (callback) => {
    ipcRenderer.on('window-unmaximized', callback)
    return () => ipcRenderer.removeListener('window-unmaximized', callback)
  },

  sendLogin: (userData) => ipcRenderer.send('login-success', userData),
  getLevel: () => ipcRenderer.invoke('getLevel'),
  getCurrentAcconutName: () => ipcRenderer.invoke('getCurrentAcconutName'),
  readConfig: () => ipcRenderer.invoke('read-config'),
  getCascaderData: () => ipcRenderer.invoke('get-cascader-data'),

  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  generateAndExport: (data) => ipcRenderer.invoke('save-document', data),
  //数据库操作
  db: {
    //文档
    createDocument: (data) => ipcRenderer.invoke('database', { action: 'createDocument', data }),
    getDocumentsByTypeWithKeywords: (doc_type) => ipcRenderer.invoke('database', { action: 'getDocumentsByTypeWithKeywords', data: doc_type }),
    getDocumentById: (uuid) => ipcRenderer.invoke('database', { action: 'getDocumentById', data: uuid }),
    updateDocument: (data) => ipcRenderer.invoke('database', { action: 'updateDocument', data }),
    deleteDocument: (data) => ipcRenderer.invoke('database', { action: 'deleteDocument', data }),

    //转为重要文件
    convertToImportant: (uuid) => ipcRenderer.invoke('database', { action: 'convertToImportant', data: uuid }),

    //普通文档批注
    addAnnotation: (data) => ipcRenderer.invoke('database', { action: 'addAnnotation', data }),
    getAnnotations: (data) => ipcRenderer.invoke('database', { action: 'getAnnotations', data }),
    deleteAnnotate: (data) => ipcRenderer.invoke('database', { action: 'deleteAnnotate', data }),
    deleteAnnotates: (data) => ipcRenderer.invoke('database', { action: 'deleteAnnotates', data }),
    updateAnnotate: (data) => ipcRenderer.invoke('database', { action: 'updateAnnotate', data }),


    //姓名管理
    findAuthorsByName: (name) => ipcRenderer.invoke('database', { action: 'findAuthorsByName', data: name }),
    createAuthor: (data) => ipcRenderer.invoke('database', { action: 'createAuthor', data }),
    createAuthors: (data) => ipcRenderer.invoke('database', { action: 'createAuthors', data }),
    addAuthorAlias: (data) => ipcRenderer.invoke('database', { action: 'addAuthorAlias', data }),
    getAuthors: () => ipcRenderer.invoke('database', { action: 'getAuthors' }),
    getAuthorsWithAliases: () => ipcRenderer.invoke('database', { action: 'getAuthorsWithAliases' }),
    deleteAuthor: (id) => ipcRenderer.invoke('database', { action: 'deleteAuthor', data: id }),
    deleteAlias: (id) => ipcRenderer.invoke('database', { action: 'deleteAlias', data: id }),
    searchAuthors: (query) => ipcRenderer.invoke('database', { action: 'searchAuthors', data: query }),
    updateAuthor: (data) => ipcRenderer.invoke('database', { action: 'updateAuthor', data }),

    //单位管理
    findUnitByName: (name) => ipcRenderer.invoke('database', { action: 'findUnitByName', data: name }),
    createUnit: (data) => ipcRenderer.invoke('database', { action: 'createUnit', data }),
    addUnitSon: (data) => ipcRenderer.invoke('database', { action: 'addUnitSon', data }),
    getUnits: () => ipcRenderer.invoke('database', { action: 'getUnits' }),
    getUnitWithSon: () => ipcRenderer.invoke('database', { action: 'getUnitWithSon' }),
    getUnitWithSonToManager: () => ipcRenderer.invoke('database', { action: 'getUnitWithSonToManager' }),
    deleteUnit: (id) => ipcRenderer.invoke('database', { action: 'deleteUnit', data: id }),
    deleteUnitSon: (id) => ipcRenderer.invoke('database', { action: 'deleteUnitSon', data: id }),
    searchUnit: (query) => ipcRenderer.invoke('database', { action: 'searchUnit', data: query }),
    updateUnitWithSons: (data) => ipcRenderer.invoke('database', { action: 'updateUnitWithSons', data }),

    getOperations: () => ipcRenderer.invoke('database', { action: 'getOperations' }),

    login: (data) => ipcRenderer.invoke('database', { action: 'login', data }),

    //关键词
    getKeyWords: () => ipcRenderer.invoke('database', { action: 'getKeyWords' }),
    getKeyWordsAll: () => ipcRenderer.invoke('database', { action: 'getKeyWordsAll' }),
    //关联列表
    linkDocKeywords: (data) => ipcRenderer.invoke('database', { action: 'linkDocKeywords', data }),
    createKeyWords: (data) => ipcRenderer.invoke('database', { action: 'createKeyWords', data }),
    getDocumentsByKeywordId: (data) => ipcRenderer.invoke('database', { action: 'getDocumentsByKeywordId', data }),

    // 文件流转
    addFlowRecord: (data) => ipcRenderer.invoke('database', { action: 'addFlowRecord', data }),
    getFlowRecords: (data) => ipcRenderer.invoke('database', { action: 'getFlowRecords', data }),
    updateFlowRecord: (data) => ipcRenderer.invoke('database', { action: 'updateFlowRecord', data }),
    deleteFlowRecord: (data) => ipcRenderer.invoke('database', { action: 'deleteFlowRecord', data }),
    updatePassword: (data) => ipcRenderer.invoke('database', { action: 'updatePassword', data }),

  },
  // store: {
  //   saveCredentials: (data) => ipcRenderer.invoke('store', { action: 'saveCredentials', data }),
  //   getCredentials: () => ipcRenderer.invoke('store', { action: 'getCredentials' }),
  //   clearCredentials: () => ipcRenderer.invoke('store', { action: 'clearCredentials' })
  // },
  send: (result) => ipcRenderer.send('dialog:response', { action: result }),
  loadResizableTable: () => {
    return new Promise((resolve, reject) => {
     // 检查是否已加载
      if (window.__resizableTableLoaded && window.__keywordResizableTableLoaded) {
        return resolve(true);
      }
      const scripts = [
        {
          id: 'resizable-table-script',
          src: '../components/resizelist/resizelist.js',
          flag: '__resizableTableLoaded'
        }
        ,
        {
          id: 'keyword-resizable-table-script',
          src: '../components/resizelist/keywordresizelist.js',
          flag: '__keywordResizableTableLoaded'
        }
      ];
      let loadedCount = 0;
      const totalScripts = scripts.length;
      const handleLoad = () => {
        if (++loadedCount === totalScripts) {
          resolve(true); // 全部加载完成后统一 resolve
        }
      };
      scripts.forEach(({ id, src, flag }) => {
        // 跳过已加载的组件
        if (window[flag]) return handleLoad();

        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.onload = () => {
          window[flag] = true; // 设置独立加载标记
          handleLoad();
        };
        script.onerror = () => reject(new Error(`[${id}] 加载失败`));
        document.head.appendChild(script);
      });

//  // 检查是否已加载
//       if (window.__resizableTableLoaded) {
//         return resolve(true);
//       }

//       const script = document.createElement('script');
//       script.src = '../components/resizelist/resizelist.js';
//       script.onload = () => {
//         window.__resizableTableLoaded = true; // 设置加载标记
//         resolve(true);
//       };
//       script.onerror = () => reject(new Error('脚本加载失败'));
//       document.head.appendChild(script);


    });
  }
})

console.log('预加载脚本已执行')