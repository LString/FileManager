const Database = require('better-sqlite3');
// const { create } = require('core-js/core/object');
const { app } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

class DB {
  constructor() {
    // const dbPath = isDev
    //   ? path.join(process.cwd(), 'documents.db')
    //   : path.join(app.getPath('userData'), 'documents.db');
    const dbPath = path.join(process.cwd(), 'documents.db')

    console.log('当前数据库路径:', dbPath);

    this.connection = new Database(dbPath);
    this.connection.pragma('foreign_keys = ON');
    this.initializeSchema();
    this.prepareStatements();
  }

  initializeSchema() {
    this.connection.exec(`
      -- 文档表（合并普通和重要文档）
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        doc_type INTEGER NOT NULL, -- 1: 普通, 2: 重要
        sender_unit TEXT NOT NULL,
        sender_number TEXT NOT NULL,
        sender_date TEXT NOT NULL,
        input_user TEXT NOT NULL,
        drafting_unit TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
        review_leader TEXT,
        secrecy_level TEXT NOT NULL,
        crgency_level TEXT NOT NULL,
        secrecy_period TEXT NOT NULL,
        remarks TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_documents_uuid ON documents(uuid);
      CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(doc_type);

      CREATE TRIGGER IF NOT EXISTS update_document_timestamp 
      AFTER UPDATE ON documents 
      BEGIN
        UPDATE documents SET updated_at = (datetime('now', 'localtime')) WHERE id = old.id;
      END;

      

      -- 作者表（保持不变）
      CREATE TABLE IF NOT EXISTS authors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        unit TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      -- 作者别名表（保持不变）
      CREATE TABLE IF NOT EXISTS author_alias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        author_id INTEGER NOT NULL,
        alias TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE CASCADE
      );

      -- 单位表
      CREATE TABLE IF NOT EXISTS unit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      -- 单位子部门表
      CREATE TABLE IF NOT EXISTS unit_son (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unit_id INTEGER NOT NULL,
        unit_son_name TEXT NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(unit_id) REFERENCES unit(id) ON DELETE CASCADE
      );

      -- 账户
      CREATE TABLE IF NOT EXISTS account (
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        level INTEGER NOT NULL
      );

      -- 批注表（合并普通和重要批注）
      CREATE TABLE IF NOT EXISTS annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL,
        annotate_type INTEGER NOT NULL, -- 1: 普通, 2: 重要
        annotate_at TEXT NOT NULL,
        processing_mode INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        distribution_scope TEXT,
        distribution_at TEXT,
        content TEXT,
        annotate_note TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(uuid) REFERENCES documents(uuid) ON DELETE CASCADE,
        FOREIGN KEY(author_id) REFERENCES authors(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_annotations_uuid ON annotations(uuid);
      CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(annotate_type);

      -- 批注处理人关联表
      CREATE TABLE IF NOT EXISTS annotation_handlers (
        annotation_id INTEGER NOT NULL,
        next_author_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(annotation_id) REFERENCES annotations(id) ON DELETE CASCADE
      );
      
      --数据库操作日志表
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        operator TEXT NOT NULL,
        operation_type TEXT NOT NULL,
        details TEXT NOT NULL,
        operation_time DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      --关键词管理列表
      CREATE TABLE IF NOT EXISTS key_words (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        keyword TEXT NOT NULL,
        description TEXT,
        create_time DATETIME DEFAULT (datetime('now', 'localtime'))
      );

      --关键词关联列表
      CREATE TABLE IF NOT EXISTS doc_keywords (
        doc_id INTEGER NOT NULL,
        keyword_id INTEGER NOT NULL,
        PRIMARY KEY (doc_id, keyword_id),
        FOREIGN KEY (doc_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (keyword_id) REFERENCES key_words(id) ON DELETE CASCADE
      );

      -- 分发单位（文件流转）关联表
      CREATE TABLE IF NOT EXISTS document_distribution (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_uuid TEXT NOT NULL,
        annotation_id INTEGER NOT NULL,
        unit_id INTEGER NOT NULL,
        distributing_leader_id TEXT NOT NULL,
        distributed_at TEXT,
        back_at TEXT,
        FOREIGN KEY(document_uuid) REFERENCES documents(uuid) ON DELETE CASCADE,
        FOREIGN KEY(annotation_id) REFERENCES annotations(id) ON DELETE CASCADE,
        FOREIGN KEY(unit_id) REFERENCES unit(id) ON DELETE RESTRICT,
        FOREIGN KEY(distributing_leader_id) REFERENCES authors(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_distribution_doc ON document_distribution(document_uuid);
      CREATE INDEX IF NOT EXISTS idx_distribution_annotation ON document_distribution(annotation_id);
      CREATE INDEX IF NOT EXISTS idx_distribution_unit ON document_distribution(unit_id);

      -- 文件流转记录表
      CREATE TABLE IF NOT EXISTS flow_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_uuid TEXT NOT NULL,
        unit TEXT NOT NULL,
        supervisors TEXT,
        distributed_at TEXT,
        back_at TEXT,
        created_at DATETIME DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(document_uuid) REFERENCES documents(uuid) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_flow_records_uuid ON flow_records(document_uuid);
    `);

    // Ensure new column exists for legacy databases
    const flowColumns = this.connection.prepare("PRAGMA table_info(flow_records)").all();
    const hasSupervisors = flowColumns.some(col => col.name === 'supervisors');
    if (!hasSupervisors) {
      this.connection.prepare("ALTER TABLE flow_records ADD COLUMN supervisors TEXT").run();
    }
  }

  prepareStatements() {
    this.statements = {
      createAccount: this.connection.prepare(
        `INSERT INTO account(
        username,password,level
        )VALUES(
        @username,@password,@level)
        `
      ),

      getAccount: this.connection.prepare(
        `SELECT * FROM account WHERE username=@username`
      ),

      updateAccountPassword: this.connection.prepare(
        `UPDATE account SET password=@password WHERE username=@username`
      ),

      /******************** 文档操作 ********************/
      createDocument: this.connection.prepare(`
        INSERT INTO documents (
          uuid, doc_type, title, sender_number, sender_date, sender_unit, 
          secrecy_level, secrecy_period, input_user,
          drafting_unit, crgency_level, review_leader,
          remarks
        ) VALUES (
          @uuid, @doc_type, @title, @sender_number, @sender_date, @sender_unit, 
          @secrecy_level, @secrecy_period, @input_user,
          @drafting_unit, @crgency_level, @review_leader,
          @remarks
        )`),

      getDocumentsByType: this.connection.prepare(`
        SELECT *
        FROM documents 
        WHERE doc_type = @doc_type
        ORDER BY created_at DESC`),

      getDocumentsByTypeWithKeywords: this.connection.prepare(`
        SELECT 
          d.id,
          d.uuid,
          d.doc_type,
          d.sender_unit,
          d.sender_number,
          d.sender_date,
          d.input_user,
          d.drafting_unit,
          d.title,
          d.created_at,
          d.updated_at,
          d.review_leader,
          d.secrecy_level,
          d.crgency_level,
          d.secrecy_period,
          d.remarks,
          COALESCE(  -- 处理无关键词情况
            (
              SELECT JSON_GROUP_ARRAY(
                JSON_OBJECT(
                  'id', kw.id,
                  'keyword', kw.keyword,
                  'create_time', kw.create_time
                )
              )
              FROM doc_keywords dk
              INNER JOIN key_words kw ON dk.keyword_id = kw.id
              WHERE dk.doc_id = d.id
            ),
            '[]'  -- 返回空数组而非NULL
          ) AS keywords
        FROM documents AS d
        WHERE d.doc_type = @doc_type
        ORDER BY d.created_at DESC
      `),

      getDocumentById: this.connection.prepare(`
        SELECT * FROM documents WHERE uuid = @uuid`),

      updateDocument: this.connection.prepare(`
        UPDATE documents SET
          title = @title,
          sender_number = @sender_number,
          sender_date = @sender_date,
          sender_unit = @sender_unit,
          secrecy_level = @secrecy_level,
          secrecy_period = @secrecy_period,
          crgency_level = @crgency_level,
          drafting_unit = @drafting_unit,
          review_leader = @review_leader,
          remarks = @remarks
        WHERE uuid = @uuid`),

      deleteDocument: this.connection.prepare(`
        DELETE FROM documents WHERE uuid = @uuid`),


      /******************** 批注操作 ********************/
      addAnnotation: this.connection.prepare(`
        INSERT INTO annotations (
          annotate_type, processing_mode, uuid, 
          content, annotate_note, author_id,
          annotate_at, distribution_scope, distribution_at
        ) VALUES (
          @annotate_type, @processing_mode, @uuid, 
          @content, @annotate_note, @author_id,
          @annotate_at, @distribution_scope, @distribution_at
        )`),

      getAnnotations: this.connection.prepare(`
        SELECT 
          a.id, 
          a.uuid,
          a.annotate_type,
          a.annotate_at,
          a.processing_mode,
          au.name AS author_name,  -- 将author_id转换为author_name
          a.distribution_scope,
          a.distribution_at,
          a.content,
          a.annotate_note,
          a.created_at
        FROM annotations AS a
        INNER JOIN authors AS au 
          ON a.author_id = au.id  -- 通过author_id关联作者表
        WHERE 
          a.uuid = @uuid  -- 根据uuid过滤批注
        ORDER BY a.annotate_at DESC;  
      `),
      updateAnnotate: this.connection.prepare(`
        UPDATE annotations
        SET 
          annotate_type = @annotate_type,
          processing_mode = @processing_mode,
          content = @content,
          annotate_note = @annotate_note,
          author_id = @author_id,
          annotate_at = @annotate_at,
          distribution_scope = @distribution_scope,
          distribution_at = @distribution_at
        WHERE id = @annotation_id;
      `),
      deleteAnnotate: this.connection.prepare(`
        DELETE FROM annotations 
        WHERE id = @id;
        `),

      deleteAnnotates: this.connection.prepare(`
        DELETE FROM annotations 
        WHERE id IN (
          SELECT CAST(value AS INTEGER) 
          FROM json_each('[' || @group_ids || ']')
        );
        `),

      /******************** 作者操作 ********************/
      createAuthor: this.connection.prepare(`
        INSERT INTO authors (name, unit) 
        VALUES (@name, @unit)
        RETURNING id
      `),

      findAuthorsByName: this.connection.prepare(`
          SELECT * FROM authors 
          WHERE name = @name 
          ORDER BY created_at DESC
        `),

      getAuthors: this.connection.prepare(`
          SELECT *
          FROM authors
          ORDER BY created_at DESC`),

      getAuthorById: this.connection.prepare(`
        SELECT * FROM authors WHERE id = @id`),

      addAuthorAlias: this.connection.prepare(`
        INSERT INTO author_alias (author_id, alias)
        VALUES (@author_id, @alias)
        RETURNING id
      `),

      getAuthorAliases: this.connection.prepare(`
        SELECT alias FROM author_alias 
        WHERE author_id = @author_id
        ORDER BY created_at DESC`),

      findAuthorByAlias: this.connection.prepare(`
        SELECT a.* 
        FROM authors a
        JOIN author_alias aa ON a.id = aa.author_id
        WHERE aa.alias = @alias`),

      getAuthorsWithAliases: this.connection.prepare(`
          SELECT 
            a.id AS authorId,
            a.name,
            COALESCE(
              (
                SELECT JSON_GROUP_ARRAY(
                  JSON_OBJECT(
                    'id', aa.id,
                    'alias', aa.alias
                  )
                )
                FROM author_alias aa
                WHERE aa.author_id = a.id
              ),
              '[]'
            ) AS aliases,
            a.unit
          FROM authors a
          ORDER BY a.created_at DESC
        `),

      searchAuthors: this.connection.prepare(`
        SELECT a.id, a.name, aa.alias FROM authors 
          a LEFT JOIN author_alias aa 
          ON a.id = aa.author_id WHERE a.name LIKE 
          @query OR aa.alias LIKE @query 
          GROUP BY a.id
        `),

      deleteAuthor: this.connection.prepare(`
          DELETE FROM authors 
          WHERE id = @authorId
        `),

      deleteAlias: this.connection.prepare(`
          DELETE FROM author_alias 
          WHERE id = @aliasId
        `),

      /******************** 单位操作 ********************/
      createUnit: this.connection.prepare(`
        INSERT INTO unit (name) 
        VALUES (@name)
        RETURNING id
      `),

      findUnitByName: this.connection.prepare(`
          SELECT * FROM unit 
          WHERE name = @name 
          ORDER BY created_at DESC
        `),

      getUnits: this.connection.prepare(`
          SELECT *
          FROM unit
          ORDER BY created_at DESC`),

      getUnitById: this.connection.prepare(`
        SELECT * FROM unit WHERE id = @id`),

      addUnitSon: this.connection.prepare(`
        INSERT INTO unit_son (unit_id, unit_son_name)
        VALUES (@unit_id, @unit_son_name)
        RETURNING id
      `),

      getUnitSons: this.connection.prepare(`
        SELECT unit_son_name FROM unit_son 
        WHERE unit_id = @unit_id
        ORDER BY created_at DESC`),

      getUnitWithSon: this.connection.prepare(`
          SELECT 
            a.id AS unitId,
            a.name,
            COALESCE(
              (
                SELECT JSON_GROUP_ARRAY(
                  JSON_OBJECT(
                    'id', aa.id,
                    'unit_son_name', aa.unit_son_name
                  )
                )
                FROM unit_son aa
                WHERE aa.unit_id = a.id
              ),
              '[]'
            ) AS unitsSon
          FROM unit a
          ORDER BY a.created_at DESC
        `),

      getUnitWithSonToManager: this.connection.prepare(`
        SELECT
          a.id AS unitId,
          a.name AS name,
          aa.id AS sonId,
          aa.unit_son_name AS sonName
        FROM unit a
        INNER JOIN unit_son aa ON a.id = aa.unit_id
        ORDER BY a.created_at DESC, aa.unit_son_name ASC;
        `),

      // 获取单位及其经手文件数
      getUnitsWithFlowCount: this.connection.prepare(`
        SELECT id, name
        FROM unit
        ORDER BY created_at DESC
      `),

      // 统计某单位的流转记录数量
      getFlowCountByUnit: this.connection.prepare(`
        SELECT COUNT(*) AS count
        FROM flow_records
        WHERE unit = @unit
      `),

      searchUnits: this.connection.prepare(`
        SELECT a.id, a.name, aa.unit_son_name FROM unit
          a LEFT JOIN unit_son aa
          ON a.id = aa.unit_id WHERE a.name LIKE
          @query OR aa.unit_son_name LIKE @query 
          GROUP BY a.id
        `),

      deleteUnit: this.connection.prepare(`
          DELETE FROM unit 
          WHERE id = @unitId
        `),

      deleteUnitSon: this.connection.prepare(`
          DELETE FROM unit_son 
          WHERE id = @unitSonId
        `),
      // 单位基础信息更新
      updateUnit: this.connection.prepare(`
          UPDATE unit SET 
            name = @newName 
          WHERE id = @unitId`),

      // 子单位名称更新
      updateUnitSon: this.connection.prepare(`
          UPDATE unit_son SET 
            unit_son_name = @newSonName 
          WHERE id = @sonId AND unit_id = @unitId`),

      //操作日志更新
      logOperation: this.connection.prepare(`
        INSERT INTO audit_log (
          table_name, operator, operation_type, details
        ) VALUES (
          @table_name, @operator, @operation_type, @details
        )
      `),

      getOperations: this.connection.prepare(`
       SELECT * FROM audit_log ORDER BY operation_time DESC
      `),

      getKeyWords: this.connection.prepare(`
       SELECT id,keyword FROM key_words ORDER BY id DESC
      `),

      getKeyWordsAll: this.connection.prepare(`
        SELECT 
        kw.*, 
        COUNT(dk.doc_id) AS fileCount 
        FROM key_words kw
        LEFT JOIN doc_keywords dk ON kw.id = dk.keyword_id
        GROUP BY kw.id
        ORDER BY kw.id DESC
      `),

      createKeyWord: this.connection.prepare(`
       INSERT INTO key_words (keyword) 
        VALUES (@keyword)
        RETURNING id
      `),

      deleteKeyWordById: this.connection.prepare(`
       DELETE FROM key_words 
          WHERE id = @unitId
      `),

      deleteKeyWordByWord: this.connection.prepare(`
       DELETE FROM key_words 
          WHERE keyword = @keyword
      `),

      // 删除文档的所有关键词关联
      deleteAllDocKeywords: this.connection.prepare(`
        DELETE FROM doc_keywords 
        WHERE doc_id = @docId
      `),

      // 添加文档-关键词关联
      addDocKeyword: this.connection.prepare(`
        INSERT INTO doc_keywords (doc_id, keyword_id)
        VALUES (@docId, @keywordId)
      `),

      getDocumentsByKeywordId: this.connection.prepare(`
        SELECT d.id, d.uuid, d.title
        FROM documents AS d
        INNER JOIN doc_keywords AS dk ON d.id = dk.doc_id
        WHERE dk.keyword_id = @keywordId
      `),

      addDistribution: this.connection.prepare(`
        INSERT INTO document_distribution (
          document_uuid, annotation_id, unit_id, 
          distributing_leader_id, distributed_at, back_at
        ) VALUES (
          @document_uuid, @annotation_id, @unit_id, 
          @distributing_leader_id, @distributed_at, @back_at
        )
    `),
      getDistributionsByDocument: this.connection.prepare(`
        SELECT 
          dd.id,
          dd.document_uuid,
          dd.annotation_id,
          u.name AS unit_name,
          a.name AS leader_name,
          dd.distributed_at,
          dd.back_at
        FROM document_distribution dd
        JOIN unit u ON dd.unit_id = u.id
        JOIN authors a ON dd.distributing_leader_id = a.id
        WHERE dd.document_uuid = @document_uuid
        ORDER BY dd.distributed_at DESC
    `),

      getDistributionsByAnnotation: this.connection.prepare(`
        SELECT 
          dd.id,
          dd.document_uuid,
          u.name AS unit_name,
          a.name AS leader_name,
          dd.distributed_at,
          dd.back_at
        FROM document_distribution dd
        JOIN unit u ON dd.unit_id = u.id
        JOIN authors a ON dd.distributing_leader_id = a.id
        WHERE dd.annotation_id = @annotation_id
        ORDER BY dd.distributed_at DESC
      `),

      updateDistribution: this.connection.prepare(`
        UPDATE document_distribution SET
          unit_id = @unit_id,
          distributing_leader_id = @distributing_leader_id,
          distributed_at = @distributed_at,
          back_at = @back_at
        WHERE id = @id
      `),

      deleteDistribution: this.connection.prepare(`
        DELETE FROM document_distribution WHERE id = @id
      `),

      getDistributionById: this.connection.prepare(`
        SELECT * FROM document_distribution WHERE id = @id
      `),

      /******************** 文件流转记录 ********************/
      addFlowRecord: this.connection.prepare(`
        INSERT INTO flow_records (
          document_uuid, unit, supervisors, distributed_at, back_at
        ) VALUES (
          @document_uuid, @unit, @supervisors, @distributed_at, @back_at
        )
      `),

      getFlowRecords: this.connection.prepare(`
        SELECT id, unit, supervisors, distributed_at, back_at
        FROM flow_records
        WHERE document_uuid = @document_uuid
        ORDER BY id
      `),

      // 根据单位名称获取流转文件及时间
      getDocumentsByUnitName: this.connection.prepare(`
        SELECT f.document_uuid, f.distributed_at, f.back_at, d.title
        FROM flow_records AS f
        INNER JOIN documents AS d ON f.document_uuid = d.uuid
        WHERE f.unit = @unit
        ORDER BY f.id
      `),

      updateFlowRecord: this.connection.prepare(`
        UPDATE flow_records SET
          supervisors = COALESCE(@supervisors, supervisors),
          distributed_at = COALESCE(@distributed_at, distributed_at),
          back_at = COALESCE(@back_at, back_at)
        WHERE id = @id
      `),

      deleteFlowRecord: this.connection.prepare(`
        DELETE FROM flow_records WHERE id = @id
      `),

    };
  }

  convertToImportant(normalUuid) {
    return this.connection.transaction(() => {
      // 直接更新文档类型
      const updateResult = this.connection.prepare(`
        UPDATE documents 
        SET doc_type = 2 
        WHERE uuid = @uuid AND doc_type = 1
      `).run({ uuid: normalUuid });

      if (updateResult.changes === 0) {
        throw new Error('文档转换失败：未找到普通文档或已是重要文档');
      }

      // 自动级联更新批注类型（如果需要）
      this.connection.prepare(`
        UPDATE annotations 
        SET annotate_type = 2 
        WHERE uuid = @uuid
      `).run({ uuid: normalUuid });

      return normalUuid; // 保持UUID不变
    })();
  }
  updateAuthor({ authorId, newName, newUnit, newAliases, deleteAliasIds }) {
    return this.connection.transaction(() => {
      // 更新作者信息
      this.connection.prepare(
        'UPDATE authors SET name = ?, unit = ? WHERE id = ?'
      ).run(newName, newUnit, authorId);

      // 删除别名
      if (deleteAliasIds.length > 0) {
        const stmt = this.connection.prepare(
          'DELETE FROM author_alias WHERE id = ?'
        );
        deleteAliasIds.forEach(id => stmt.run(id));
      }

      // 新增别名
      if (newAliases.length > 0) {
        const stmt = this.connection.prepare(
          'INSERT INTO author_alias (author_id, alias) VALUES (?, ?)'
        );
        newAliases.forEach(alias => stmt.run(authorId, alias));
      }
    })();
  }

  updateUnitWithSons(unitId, newUnitName, sonUpdates = []) {
    return this.connection.transaction(() => {
      let unitResult; // 提前声明变量
      // 更新主单位名称
      if (newUnitName) {
        unitResult = this.statements.updateUnit.run({
          unitId: unitId,
          newName: newUnitName
        });

        if (unitResult.changes === 0) {
          throw new Error('单位ID不存在或名称未变更');
        }
      }

      // 批量更新子单位
      if (sonUpdates.length > 0) {
        const sonStmt = this.statements.updateUnitSon;
        sonUpdates.forEach(({ sonId, newSonName }) => {
          const result = sonStmt.run({
            unitId: unitId,
            sonId: sonId,
            newSonName: newSonName
          });

          if (result.changes === 0) {
            throw new Error(`子单位ID ${sonId} 更新失败，请检查父子关系`);
          }
        });
      }

      return {
        unitChanges: unitResult?.changes || 0,
        sonChanges: sonUpdates.length
      };
    })();
  }

  createAuthors(newAuthors) {
    // 批量创建姓名
    if (newAuthors.length > 0) {
      const authorStmt = this.statements.createAuthor;
      newAuthors.forEach((item) => {
        const result = authorStmt.run({ name: item, unit: null });
        if (result.changes === 0) {
          throw new Error(`子单位ID 更新失败，请检查父子关系`);
        }
      });
    }
    return newAuthors.length;
  }
  createKeyWords(newKeyWords) {
    const idList = []; // 存储新关键词ID的数组
    const keyWordStmt = this.statements.createKeyWord;

    if (newKeyWords.length > 0) {
      newKeyWords.forEach((item) => {
        // 执行插入并获取返回的ID 
        const result = keyWordStmt.get({ keyword: item });
        if (result && result.id) {
          idList.push(result.id);
        } else {
          throw new Error(`关键词插入失败: ${item}`);
        }
      });
    }
    return idList; // 返回新插入关键词的ID数组
  }

  linkDocKeywords(docId, keywordIds) {
    return new Promise((resolve, reject) => {
      try {
        // 检查输入有效性
        if (!docId || !keywordIds || keywordIds.length === 0) {
          resolve(0); // 无效输入返回0
          return;
        }

        // 准备SQL语句
        const placeholders = keywordIds.map(() => '(?, ?)').join(', ');
        const sql = `
          INSERT OR IGNORE INTO doc_keywords (doc_id, keyword_id)
          VALUES ${placeholders}
        `;

        // 准备参数数组 [docId, keywordId1, docId, keywordId2, ...]
        const params = [];
        keywordIds.forEach(keywordId => {
          params.push(docId, keywordId);
        });

        // 执行批量插入
        const stmt = this.connection.prepare(sql);
        const result = stmt.run(...params);

        // 返回成功插入的数量
        resolve(result.changes);
      } catch (error) {
        console.error('关联文档关键词失败:', error);
        reject(error);
      }
    });
  }
}

module.exports = DB;