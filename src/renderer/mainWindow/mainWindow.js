// 初始化日期选择器
/* global flatpickr */
const annotate_date = flatpickr("#annotate-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

const annotate_fenfa_date = flatpickr("#fenfa-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

const annotate_edit_date = flatpickr("#annotate-edit-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

const annotate_edit_fenfa_date = flatpickr("#fenfa-edit-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});
// sender_date

const sender_date = flatpickr("#sender_date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});
flatpickr("#pop-sender_date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

let users; //用户列表缓存
let globalWordsCatchs;//关键词列表缓存
let annotateTemp = [];//新建文档的批注缓存
let globalUnits; //单位缓存列表

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[初始化] DOM加载完成')
  // 带错误检查的元素获取
  const getElement = (id) => {
    const el = document.getElementById(id)
    if (!el) {
      console.error(`[错误] 找不到元素 #${id}`)
      return null
    }
    return el
  }

  // 获取控制按钮
  const minimizeBtn = getElement('minimize')
  const maximizeBtn = getElement('maximize')
  const closeBtn = getElement('close')

  // 验证API可用性
  if (!window.electronAPI) {
    console.error('[致命错误] electronAPI 未定义!')
    return
  }
  // 最小化按钮
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => {
      console.log('[事件] 点击最小化按钮')
      window.electronAPI.minimize()
    })
  }
  // 最大化/还原按钮
  if (maximizeBtn) {
    maximizeBtn.addEventListener('click', () => {
      console.log('[事件] 点击最大化按钮')
      window.electronAPI.maximize()
    })

    // 状态同步
    window.electronAPI.onMaximized(() => {
      maximizeBtn.textContent = '❐'
      console.log('[状态] 窗口最大化')
    })

    window.electronAPI.onUnmaximized(() => {
      maximizeBtn.textContent = '□'
      console.log('[状态] 窗口还原')
    })
  }
  // 关闭按钮
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[事件] 点击关闭按钮')
      window.electronAPI.close()
    })
  }

  loadSetting()

  const tabs = document.querySelectorAll('.tab-btn');
  const dataManagerBtn = document.getElementById('data-manager');
  const popupMenu = document.getElementById('data-manager-popup');
  const popupItems = document.querySelectorAll('.popup-item');
  const tabContents = document.querySelectorAll('.tab-content');
  // 修改后的标签切换逻辑
  tabs.forEach(btn => {
    btn.addEventListener('click', (e) => {

      if (btn === dataManagerBtn) {
        e.stopPropagation();
        return;
      }
      // 获取目标标签ID
      const tabId = btn.dataset.tab;
      const targetContent = document.getElementById(`${tabId}-tab`);

      // 防御性检查
      if (!targetContent) {
        console.error(`找不到对应内容区域: ${tabId}-tab`);
        return;
      }

      // 切换激活状态
      document.querySelectorAll('.tab-btn, .tab-content').forEach(el => {
        el.classList.remove('active');
        const img = el.querySelector('img');
        if (img) {
          img.src = img.src.replace('_active.png', '.png'); // 恢复默认图标
        }
      });

      btn.classList.add('active');
      targetContent.classList.add('active');
      // if(targetContent.id == `view-normal-tab`){
      //   refreshDocList(1)
      // }else if(targetContent.id == `view-important-tab`){
      //   refreshDocList(2)
      // }
      // if(targetContent.id == `view-normal-tab`){
      //   initKeywordTable()
      // }
      const currentImg = btn.querySelector('img');
      if (currentImg) {
        currentImg.src = currentImg.src.replace('.png', '_active.png');
      }
    });
  });


  dataManagerBtn.addEventListener('click', function (e) {
    e.stopPropagation();

    // 计算菜单位置
    const btnRect = dataManagerBtn.getBoundingClientRect();
    popupMenu.style.top = `${btnRect.top}px`;
    popupMenu.style.left = `${btnRect.right + 5}px`;

    // 切换菜单显示状态
    const isVisible = popupMenu.style.display === 'block';
    popupMenu.style.display = isVisible ? 'none' : 'block';

    // dataManagerBtn.classList.toggle('active', !isVisible);
  });
  // 菜单项点击事件
  popupItems.forEach(item => {
    item.addEventListener('click', function () {
      const tabId = this.dataset.tab + '-tab';
      // 隐藏所有标签内容
      tabs.forEach(tab => {
        tab.classList.remove('active');
        const img = tab.querySelector('img');
        if (img) {
          img.src = img.src.replace('_active.png', '.png');
        }
      });

      // 隐藏所有标签内容
      tabContents.forEach(tab => {
        tab.classList.remove('active');
      });

      dataManagerBtn.classList.toggle('active');
      const currentImg = dataManagerBtn.querySelector('img');
      if (currentImg) {
        currentImg.src = currentImg.src.replace('.png', '_active.png');
      }

      // 显示选中的标签内容
      const selectedTab = document.getElementById(tabId);
      if (selectedTab) {
        selectedTab.classList.add('active');
      }

      // 隐藏菜单
      popupMenu.style.display = 'none';
    });
  });

  // 点击页面其他地方关闭菜单
  document.addEventListener('click', function (e) {
    if (popupMenu.style.display === 'block' &&
      !popupMenu.contains(e.target) &&
      !dataManagerBtn.contains(e.target)) {
      popupMenu.style.display = 'none';
      dataManagerBtn.classList.remove('active');
    }
  });
  /**
   * 新建文档（普通、重要）
   */

  let newReview_leaders = [];
  let keywords = [];
  const keywordIds = []
  const docForm = document.getElementById('newDoc-docForm');
  const new_doc_add_annotate = document.getElementById('new_doc_add_annotate')
  const hasAnnotate = document.getElementById('hasAnnotate')

  new_doc_add_annotate.addEventListener('click', function () {
    showAnnotateAdd()
  })

  hasAnnotate.addEventListener('click', function () {
    showAnnotateLook()
    loadAnnotateList()
  })


  docForm.addEventListener('submit', async (e) => {
    e.preventDefault();// 阻止默认提交行为（页面跳转）

    const submitter = e.submitter;
    const docType = submitter?.value || 'normal'; // 默认值

    // 更新缓存批注的类型以匹配当前文档类型
    annotateTemp = annotateTemp.map(anno => ({
      ...anno,
      annotate_type: docType === 'normal' ? 1 : 2
    }));

    try {

      //默认不输入+号时，添加输入内容
      const inputleader =
        document.getElementById("review_leader").value.trim()
      if (inputleader) {
        newReview_leaders.push(inputleader)
      }

      const inputkeyword =
        document.getElementById("key_words").value.trim()
      if (inputkeyword) {
        keywords.push(inputkeyword)
      }

      let docId
      //判断姓名是否是匹配数据库的名字
      const newName = newReview_leaders.filter(item => !users.some(user => user.name === item))

      if (newName.length > 0) {//有新增，创建
        await window.electronAPI.db.createAuthors(newName)
      }

      let newKeyWords = []
      //判断关键词是否是匹配数据库
      // 处理每个关键词
      for (const item of keywords) {
        // 在缓存中查找匹配的关键词
        const existingWord = globalWordsCatchs.find(word => word.keyword === item);

        if (existingWord) {
          // 如果关键词已存在，直接使用缓存的ID
          keywordIds.push(existingWord.id);
        } else {
          // 如果关键词不存在，添加到新增列表
          newKeyWords.push(item);
        }
      }

      if (newKeyWords.length > 0) {//有新增，创建
        let newIds = await window.electronAPI.db.createKeyWords(newKeyWords)
        keywordIds.push(...newIds)
      }

      const data = {
        doc_type: docType === "normal" ? 1 : 2,
        title: document.getElementById('docTitle').value.trim(),
        sender_number: document.getElementById('sender_number').value.trim(),
        sender_date: document.getElementById('sender_date').value,
        sender_unit: document.getElementById('sender_unit').value.trim(),
        secrecy_level: getValidatedSelectValue('#secrecy_level'),
        secrecy_period: getValidatedSelectValue('#secrecy_period'),
        drafting_unit: document.getElementById('drafting_unit').value.trim(),
        crgency_level: getValidatedSelectValue('#crgency_level'),
        review_leader: newReview_leaders.join(','),
        remarks: document.getElementById('remarks').value.trim(),
        annotate: annotateTemp
      };


      docId = await window.electronAPI.db.createDocument(data);

      if (docId) { // 判断是否返回有效ID

        //创建文档关键词关系表
        await window.electronAPI.db.linkDocKeywords({ doc_id: docId, keyword_ids: keywordIds });

        docForm.reset(); // 清空表单
        sender_date.setDate(new Date())
        annotateTemp.length = 0;
        newReview_leaders.length = 0;
        keywords.length = 0;
        keywordIds.length = 0;
        document.getElementById('hasAnnotate').textContent = `已有${annotateTemp.length}条备注`;
        cleartag();
        showToast('文件创建成功')
        if (docType === 'important') {
          await refreshDocList(2);
        } else {
          await refreshDocList(1); // 刷新文档列表
        }
        await loadAudit()
      }

      loadSelectOptions();
      loadKeyWordsOptions();
      loadAuthorsWithAliasesToNameManager();
      initKeywordTable();
    } catch (error) { // 错误处理
      console.error('创建文档失败:', error); // 控制台输出详细错误
      await showConfirmDialog('确定删除该子单位？');
    }
  })
  //领导多选  
  const addNameToLable = document.getElementById('add_review_leader');
  const container = document.getElementById('review_leader_container');
  addNameToLable.addEventListener('click', async () => {
    const input = document.getElementById('review_leader');
    const value = input.value.trim();

    if (value) {
      const isDuplicate = Array.from(container.querySelectorAll('#tag-content'))
        .some(span => span.textContent === value);

      if (!isDuplicate) {
        const item = aliastemp.content.cloneNode(true);
        item.querySelector('#tag-content').textContent = value;

        container.insertBefore(item, input.parentNode);
        newReview_leaders.push(value);

        // 清空输入并保持焦点
        input.value = '';
        input.focus();

        // 滚动到最右端
        container.scrollLeft = container.scrollWidth;
      }
    }
  })
  //关键字多选 
  const addKeyWordsToLable = document.getElementById('add_key_words');
  const keywordscontainer = document.getElementById('key_words_container');
  addKeyWordsToLable.addEventListener('click', async () => {
    const keyinput = document.getElementById('key_words');
    const value = keyinput.value.trim();

    if (value) {
      const isDuplicate = Array.from(keywordscontainer.querySelectorAll('#tag-content'))
        .some(span => span.textContent === value);

      if (!isDuplicate) {
        const item = aliastemp.content.cloneNode(true);
        item.querySelector('#tag-content').textContent = value;

        keywordscontainer.insertBefore(item, keyinput.parentNode);
        keywords.push(value);

        // 清空输入并保持焦点
        keyinput.value = '';
        keyinput.focus();

        // 滚动到最右端
        keywordscontainer.scrollLeft = keywordscontainer.scrollWidth;
      }
    }
  })
  //领导标签移除监听
  container.addEventListener('click', async (e) => {
    if (e.target.matches('.alias-tag-delete-btn')) {
      const item = e.target.closest('.alias-tag');
      // 处理未保存的新别名
      const content = item.querySelector('#tag-content').textContent;
      newReview_leaders = newReview_leaders.filter(a => a !== content);

      item.remove();
    }
  })
  //关键字标签移除监听
  keywordscontainer.addEventListener('click', async (e) => {
    if (e.target.matches('.alias-tag-delete-btn')) {
      const item = e.target.closest('.alias-tag');
      // 处理未保存的新别名
      const content = item.querySelector('#tag-content').textContent;
      keywords = keywords.filter(a => a !== content);

      item.remove();
    }
  })

  function cleartag() {
    const nameTags = container.querySelectorAll('.alias-tag');
    nameTags.forEach(element => element.remove());
    const keywordsTags = keywordscontainer.querySelectorAll('.alias-tag');
    keywordsTags.forEach(element => element.remove());
  }

  // //普通文件列表
  // const docList_normal = document.getElementById('docList-normal');
  // // 普通文件事件委托处理所有按钮点击
  // docList_normal.addEventListener('click', async (e) => {
  //   const btn = e.target.closest('.action-btn');
  //   if (btn) {
  //     const docItem = e.target.closest('#doc_list_item');
  //     if (!docItem) {
  //       console.error('未找到文档项元素');
  //       return;
  //     }
  //     const docId = docItem.dataset.id;

  //     // if (btn.classList.contains('edit-btn')) {
  //     //   await handleEditDoc(docId, 1);
  //     // } else if (btn.classList.contains('toimportant-btn')) {
  //     //   await handleToImportant(docId);
  //     // } else if (btn.classList.contains('annotate-btn')) {
  //     //   await handleAddAnnotation(docId, 1);
  //     // } else if (btn.classList.contains('delete-btn')) {
  //     //   await handleDeleteDoc(docId, 1);
  //     // }
  //     if (btn.classList.contains('toimportant-btn')) {
  //       await handleToImportant(docId);
  //     } else if (btn.classList.contains('annotate-btn')) {
  //       await handleAddAnnotation(docId, 1);
  //     }
  //     return;
  //   }

  //   // 处理文档项点击（显示详情）
  //   const docItem = e.target.closest('#doc_list_item');
  //   if (!docItem) return;

  //   // 正确获取各字段数据
  //   const doc = JSON.parse(docItem.dataset.doc)
  //   showEditModal(doc);

  // });

  // //重要文件列表
  // const docList_important = document.getElementById('docList-important');
  // // 重要文件事件委托处理所有按钮点击
  // docList_important.addEventListener('click', async (e) => {


  //   const btn = e.target.closest('.action-btn');
  //   if (btn) {
  //     const docItem = e.target.closest('#doc_list_item');
  //     if (!docItem) {
  //       console.error('未找到文档项元素');
  //       return;
  //     }
  //     const docId = docItem.dataset.id;
  //     const doc = JSON.parse(docItem.dataset.doc)

  //     if (btn.classList.contains('annotate-btn')) {
  //       await handleAddAnnotation(docId, 2);
  //     } else if (btn.classList.contains('print-btn')) {
  //       const formData = {
  //         sender_unit: doc.sender_unit,
  //         sender_number: doc.sender_number,
  //         original_number: doc.original_number,
  //         drafting_unit: doc.sendrafting_unitder_number,
  //         title: doc.title, // 获取并清理标题输入

  //         review_leader: doc.review_leader,
  //         secrecy_level: doc.secrecy_level,
  //         crgency_level: doc.crgency_level,
  //         secrecy_period: doc.secrecy_period
  //       };
  //       // 清理数据并验证
  //       if (formData.sender_unit == "" || formData.sender_number == "" ||
  //         formData.original_number == "" ||
  //         formData.drafting_unit == "" ||
  //         formData.title == "" ||
  //         formData.review_leader == "" ||
  //         formData.secrecy_level == "" ||
  //         formData.crgency_level == "" ||
  //         formData.secrecy_period == "") {
  //         //弹窗
  //         return;
  //       }
  //       printDoc(formData)
  //     }
  //     return;
  //   }

  //   // 处理文档项点击（显示详情）
  //   // 处理文档项点击（显示详情）
  //   const docItem = e.target.closest('#doc_list_item');
  //   if (!docItem) return;

  //   // 正确获取各字段数据
  //   const doc = JSON.parse(docItem.dataset.doc)
  //   showEditModal(doc);
  // });


  //加载创建文档时配置
  loadSelectOptions()
  loadKeyWordsOptions()
  //加载创建备注时配置
  loadUnit()
  loadAuthorsWithAliasesToNameManager()
  loadUnitWithSonToUnitManager()
  loadAudit()
//备注处理方式
// toggleFields();
//备注处理方式
// toggleEditFields();
// intypeEditSelect.addEventListener('change', toggleEditFields);

  const initialTab = document.querySelector('.tab-btn.active');
  if (initialTab) {
    const tabId = initialTab.dataset.tab;
    document.getElementById(`${tabId}-tab`)?.classList.add('active');
  }


  // 打印功能
  document.getElementById('print').addEventListener('click', async (e) => {
    e.preventDefault(); // 阻止默认行为
    try {
      // 获取用户选择的保存路径

      // 收集表单数据
      const formData = {
        sender_unit: document.getElementById('sender_unit').value.trim(), // 获取并清理作者输入
        sender_number: document.getElementById('sender_number').value.trim(), // 获取并清理内容输入
        original_number: document.getElementById('original_number').value.trim(),
        drafting_unit: document.getElementById('drafting_unit').value.trim(),
        title: document.getElementById('docTitle').value.trim(), // 获取并清理标题输入

        review_leader: getValidatedSelectValue('#review_leader'),
        secrecy_level: getValidatedSelectValue('#secrecy_level'),
        crgency_level: getValidatedSelectValue('#crgency_level'),
        secrecy_period: getValidatedSelectValue('#secrecy_period')
      };
      // 清理数据并验证
      if (formData.sender_unit == "" || formData.sender_number == "" ||
        formData.original_number == "" ||
        formData.drafting_unit == "" ||
        formData.title == "" ||
        formData.review_leader == "" ||
        formData.secrecy_level == "" ||
        formData.crgency_level == "" ||
        formData.secrecy_period == "") {
        //弹窗
        return;
      }

      printDoc(formData)

      // if (result.success) {
      //   // await showinfoDialog(`文档已保存至：${result.path}`);
      // }
    } catch (error) {
      console.error('文档生成失败:', error);
      // await showinfoDialog(`保存失败: ${error.message}`);
    }

  });

  //备注取消监听
  document.querySelector('#annotate_add .cancel').addEventListener('click', () => {
    hideAnnotateAdd();
  });

  document.getElementById('annotate-close-look').addEventListener('click', () => {
    hideAnnotateLook();
  });

  document.getElementById('annotate-close-add').addEventListener('click', () => {
    hideAnnotateAdd();
  });

  document.getElementById('annotate-edit-close-add').addEventListener('click', () => {
    hideAnnotateEdit();
  });
  //权限控制
  checkPermission()
  /**
    * 刷新列表
    */
  initResizableTable();


})
let currentType;
let currentDocId = null; // 当前操作的文档ID
// 文件流转记录，使用 localStorage 持久化
let flowRecordsMap = JSON.parse(localStorage.getItem('flowRecords') || '{}');

function hideAnnoSidebar(leftContainer, rightContainer) {
  rightContainer.classList.add('force-hidden');
  rightContainer.classList.remove('active');
  setTimeout(() => {
    rightContainer.style.display = 'none';
    rightContainer.classList.remove('force-hidden');
  }, 400);
  leftContainer.classList.remove('split-view');
  rightContainer.dataset.mode = '';
}

function toggleAnnoSidebar(leftId, rightId, rowData) {
  const leftContainer = document.getElementById(leftId);
  const rightContainer = document.getElementById(rightId);
  const uuid = rowData.uuid;
  const docType = rowData.docType || rowData.doc_type || rowData.type;

  if (currentDocId === uuid && rightContainer.style.display === 'flex') {
    hideAnnoSidebar(leftContainer, rightContainer);
    currentDocId = null;
    return;
  }

  currentDocId = uuid;
  currentType = docType;
  leftContainer.classList.add('split-view');
  rightContainer.style.display = 'flex';
  void rightContainer.offsetHeight;
  rightContainer.classList.add('active');
  if (rightId === 'view-doc-imp-right') {
    rightContainer.dataset.mode = 'anno';
    const annoPanel = document.getElementById('imp-anno-panel');
    const flowPanel = document.getElementById('imp-flow-panel');
    if (annoPanel && flowPanel) {
      annoPanel.style.display = 'flex';
      flowPanel.style.display = 'none';
    }
  }
  loadAnnotateList();
}

// 展示文件流转侧栏
function toggleFlowSidebar(leftId, rightId, rowData) {
  const leftContainer = document.getElementById(leftId);
  const rightContainer = document.getElementById(rightId);
  const uuid = rowData.uuid;
  const docType = rowData.docType || rowData.doc_type || rowData.type;

  if (
    currentDocId === uuid &&
    rightContainer.style.display === 'flex' &&
    rightContainer.dataset.mode === 'flow'
  ) {
    hideAnnoSidebar(leftContainer, rightContainer);
    currentDocId = null;
    rightContainer.dataset.mode = '';
    return;
  }

  currentDocId = uuid;
  currentType = docType;
  leftContainer.classList.add('split-view');
  rightContainer.style.display = 'flex';
  void rightContainer.offsetHeight;
  rightContainer.classList.add('active');
  rightContainer.dataset.mode = 'flow';
  const annoPanel = document.getElementById('imp-anno-panel');
  const flowPanel = document.getElementById('imp-flow-panel');
  if (annoPanel && flowPanel) {
    annoPanel.style.display = 'none';
    flowPanel.style.display = 'flex';
  }
  const flowFormEl = document.getElementById('flow-form');
  if (flowFormEl) {
    flowFormEl.style.display = 'none';
    document.getElementById('flow-unit').value = '';
    document.getElementById('flow-distributed').value = '';
    document.getElementById('flow-back').value = '';
  }
  loadFlowList();
}

function saveFlowRecords() {
  localStorage.setItem('flowRecords', JSON.stringify(flowRecordsMap));
}

function loadFlowList() {
  const tableBody = document.querySelector('#flow-table tbody');
  if (!tableBody || !currentDocId) return;
  tableBody.innerHTML = '';
  const list = flowRecordsMap[currentDocId] || [];
  list.forEach((rec, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${rec.unit || ''}</td>
      <td class="editable" data-field="distributed_at">${rec.distributed_at || ''}</td>
      <td class="editable" data-field="back_at">${rec.back_at || ''}</td>
    `;
    tableBody.appendChild(tr);
  });
}

const flowAddBtn = document.getElementById('flow-add-btn');
const flowForm = document.getElementById('flow-form');
const flowSaveBtn = document.getElementById('flow-save-btn');
const flowCancelBtn = document.getElementById('flow-cancel-btn');

flowAddBtn?.addEventListener('click', () => {
  if (!currentDocId) return;
  flowForm.style.display = 'flex';
  document.getElementById('flow-unit').focus();
});

flowSaveBtn?.addEventListener('click', () => {
  if (!currentDocId) return;
  const unitInput = document.getElementById('flow-unit');
  const distributedInput = document.getElementById('flow-distributed');
  const backInput = document.getElementById('flow-back');
  const unit = unitInput.value.trim();
  const distributed_at = distributedInput.value.trim();
  const back_at = backInput.value.trim();
  if (!unit) {
    flowForm.style.display = 'none';
    unitInput.value = '';
    distributedInput.value = '';
    backInput.value = '';
    return;
  }
  const list = flowRecordsMap[currentDocId] || [];
  list.push({ unit, distributed_at, back_at });
  flowRecordsMap[currentDocId] = list;
  saveFlowRecords();
  loadFlowList();
  unitInput.value = '';
  distributedInput.value = '';
  backInput.value = '';
  flowForm.style.display = 'none';
});

flowCancelBtn?.addEventListener('click', () => {
  document.getElementById('flow-unit').value = '';
  document.getElementById('flow-distributed').value = '';
  document.getElementById('flow-back').value = '';
  flowForm.style.display = 'none';
});

document.getElementById('flow-table')?.addEventListener('dblclick', (e) => {
  const td = e.target;
  if (td.tagName !== 'TD' || !td.classList.contains('editable')) return;
  const oldValue = td.textContent;
  const input = document.createElement('input');
  input.type = 'date';
  input.value = oldValue;
  td.textContent = '';
  td.appendChild(input);
  input.focus();
  input.addEventListener('blur', () => {
    const value = input.value;
    const field = td.dataset.field;
    td.removeChild(input);
    td.textContent = value;
    const rowIndex = td.parentElement.rowIndex - 1;
    const list = flowRecordsMap[currentDocId] || [];
    if (list[rowIndex]) {
      list[rowIndex][field] = value;
      saveFlowRecords();
    }
  });
});

async function initResizableTable() {
  try {

    await window.electronAPI.loadResizableTable();

    // 为普通文档表添加行点击监听
    const norTable = document.getElementById('norTable');
    const norMenu = document.getElementById('normal-context-menu');
    const convertItem = document.getElementById('normal-to-important');
    const editItem = document.getElementById('normal-edit-doc');
    let contextDocId = null;
    let contextDoc = null;

    norTable.addEventListener('row-click', (event) => {
      toggleAnnoSidebar('view-doc-nor-left', 'view-doc-nor-right', event.detail.data);
    });

    // 普通文档表行右键菜单
    norTable.addEventListener('contextmenu', (e) => {
      const path = e.composedPath();
      const row = path.find(el => el.tagName === 'TR' && el.dataset.index !== undefined);
      if (!row) return;
      e.preventDefault();
      contextDoc = norTable.originalData[row.dataset.index];
      contextDocId = contextDoc.uuid;
      norMenu.style.display = 'block';
      norMenu.style.left = `${e.clientX}px`;
      norMenu.style.top = `${e.clientY}px`;
    });

    convertItem.addEventListener('click', async () => {
      norMenu.style.display = 'none';
      if (contextDocId) {
        await handleToImportant(contextDocId);
      }
    });

    editItem.addEventListener('click', () => {
      norMenu.style.display = 'none';
      if (contextDoc) {
        const doc = { ...contextDoc, type: contextDoc.docType || contextDoc.doc_type || contextDoc.type };
        showEditModal(doc);
      }
    });

    // 为重要文档表添加行点击监听
    const impTable = document.getElementById('impTable');
    const impMenu = document.getElementById('important-context-menu');
    const impEditItem = document.getElementById('important-edit-doc');
    const impFlowItem = document.getElementById('important-show-flow');
    let contextDocImp = null;

    impTable.addEventListener('row-click', (event) => {
      toggleAnnoSidebar('view-doc-imp-left', 'view-doc-imp-right', event.detail.data);
    });

    impTable.addEventListener('contextmenu', (e) => {
      const path = e.composedPath();
      const row = path.find(el => el.tagName === 'TR' && el.dataset.index !== undefined);
      if (!row) return;
      e.preventDefault();
      contextDocImp = impTable.originalData[row.dataset.index];
      impMenu.style.display = 'block';
      impMenu.style.left = `${e.clientX}px`;
      impMenu.style.top = `${e.clientY}px`;
    });

    impEditItem.addEventListener('click', () => {
      impMenu.style.display = 'none';
      if (contextDocImp) {
        const doc = { ...contextDocImp, type: contextDocImp.docType || contextDocImp.doc_type || contextDocImp.type };
        showEditModal(doc);
      }
    });

    impFlowItem.addEventListener('click', () => {
      impMenu.style.display = 'none';
      if (contextDocImp) {
        toggleFlowSidebar('view-doc-imp-left', 'view-doc-imp-right', contextDocImp);
      }
    });

    document.addEventListener('click', () => {
      norMenu.style.display = 'none';
      impMenu.style.display = 'none';
    });

    // 加载脚本并等待完成
    refreshDocList(1);
    refreshDocList(2);
    initKeywordTable();
  } catch (error) {
    console.error('初始化失败:', error);
  }
}

document.getElementById('shink-anno').addEventListener('click', async (_e) => {
  const leftContainer = document.getElementById('view-doc-nor-left');
  const rightContainer = document.getElementById('view-doc-nor-right');
  hideAnnoSidebar(leftContainer, rightContainer);
  currentDocId = null;
});

document.getElementById('shink-anno-imp').addEventListener('click', async (_e) => {
  const leftContainer = document.getElementById('view-doc-imp-left');
  const rightContainer = document.getElementById('view-doc-imp-right');
  hideAnnoSidebar(leftContainer, rightContainer);
  currentDocId = null;
});




async function checkPermission() {//权限 1普通用户，2管理员
  const level = await window.electronAPI.getLevel();
  if (level != 1) {
    document.getElementById('data-manager').style.display = 'none'
  }
}

async function printDoc(formData) {
  const savePath = await window.electronAPI.showSaveDialog({
    title: '保存文档',
    defaultPath: `${formData.title}.docx`
  });

  if (!savePath || typeof savePath !== 'string') {
    // throw new Error('无效的保存路径');
  }
  // 生成带换行的条码文本
  const barcodeText = [
    `来文单位：${formData.sender_unit}`,
    `来文编号：${formData.sender_number}`,
    `原文件号：${formData.original_number}`,
    `制文单位：${formData.drafting_unit}`,
    `文件标题：${formData.title}`,
    `呈阅领导：${formData.review_leader}`,
    `密    级：${formData.secrecy_level}`,
    `紧急程度：${formData.crgency_level}`,
    `保密期限：${formData.secrecy_period}`
  ].join('\n'); // 使用换行符分隔

  // 生成并保存文档
  await window.electronAPI.generateAndExport({
    text: barcodeText,        // 字段名必须与工具类匹配
    outputPath: savePath,
    title: formData.title || "未命名文档",    // 添加文档标题
    imageWidth: 500 // 可选附加文本
  });

}

let tempListForSearch_Normal = null;//搜索/排序功能的临时数组
let tempListForSearch_Important = null;//搜索/排序功能的临时数组
let currentSortCloum = null;
let currentSortDir = 'asc'
async function refreshDocList(type = 1, searchResult = null, _searchKey = null) {
  try {
    let docs
    if (searchResult == null) {
      docs = await window.electronAPI.db.getDocumentsByTypeWithKeywords(type)
    } else {
      docs = searchResult
    }

    // 确保每条记录都包含文档类型
    docs = docs.map(doc => ({
      ...doc,
      doc_type: doc.doc_type ?? doc.docType ?? doc.type ?? type,
      docType: doc.docType ?? doc.doc_type ?? doc.type ?? type
    }))

    if (type == 1) {
      tempListForSearch_Normal = docs
    } else {
      tempListForSearch_Important = docs
    }

    let table
    if (type === 1) {
      table = document.getElementById('norTable');
    } else {
      table = document.getElementById('impTable');
    }

    table.setHeaderMap({
      id: '序号',
      title: "标题",
      sender_unit: "来文单位",
      sender_number: "来文编号",
      drafting_unit: "制文单位",
      input_user: "录入人",
      sender_date: "来文时间",
      secrecy_level: "秘密等级",
      crgency_level: "紧急程度",
      secrecy_period: "保密期限",
      review_leader: "呈阅领导",
      remarks: "标记",
    })

    table.setData(docs)

  } catch (error) {
    console.error('刷新文档列表失败:', error);
  }
}

function handleSortClick(sortby, type) { //sortby =   序号': 'id', '标题': 'title', '来文单位': 'sender_unit','制文单位': 'drafting_unit', '来文时间': 'sender_date', '录入人': 'input_user'
  if (sortby == currentSortCloum) {
    currentSortDir = currentSortDir == 'asc' ? 'desc' : 'asc'
  } else {
    currentSortDir = 'asc'
  }
  currentSortCloum = sortby
  if (type == 1) {
    tempListForSearch_Normal = sortDocuments(tempListForSearch_Normal, sortby, currentSortDir)
    updateNormalSortIcons(sortby, currentSortDir);
    refreshDocList(1, tempListForSearch_Normal)
  } else {
    tempListForSearch_Important = sortDocuments(tempListForSearch_Important, sortby, currentSortDir)
    updateImportSortIcons(sortby, currentSortDir);
    refreshDocList(2, tempListForSearch_Important)
  }
}

function sortDocuments(docs, field, direction) {
  return [...docs].sort((a, b) => {
    let aVal = a[field], bVal = b[field];

    // 处理日期
    if (field === 'sender_date') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    }

    // 比较逻辑
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });
}

const fieldMap = {
  '序号': 'id',
  '标题': 'title',
  '来文单位': 'sender_unit',
  '制文单位': 'drafting_unit',
  '来文时间': 'sender_date',
  '录入人': 'input_user'
};

function updateNormalSortIcons(currentField, direction) {
  document.querySelectorAll('#docList_normal_title_container .docList-title-colum img').forEach(img => {
    const fieldName = img.parentElement.querySelector('span').textContent.trim();
    const field = fieldMap[fieldName];
    img.src = field === currentField
      ? `../assets/image/order_${direction === 'asc' ? 'up' : 'down'}.png`
      : '../assets/image/order_up.png';
  });
}
function updateImportSortIcons(currentField, direction) {
  document.querySelectorAll('#docList_important_title_container .docList-title-colum img').forEach(img => {
    const fieldName = img.parentElement.querySelector('span').textContent.trim();
    const field = fieldMap[fieldName];
    img.src = field === currentField
      ? `../assets/image/order_${direction === 'asc' ? 'up' : 'down'}.png`
      : '../assets/image/order_up.png';
  });
}

//搜索文字高亮
// function highlightText(text, keyword) {
//   const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi'); // 转义特殊字符
//   return text.replace(regex, '<span class="highlight">$1</span>');
// }
// function escapeRegExp(str) {
//   return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// }

// document.getElementById('docList_normal_title_container').addEventListener('click', async (e) => {
//   const target = e.target;
//   switch (target.id) {
//     case 'n_order_by_id': {
//       handleSortClick('id', 1)
//       break
//     }
//     case 'n_order_by_title': {
//       handleSortClick('title', 1)
//       break
//     }
//     case 'n_order_by_sender_unit': {
//       handleSortClick('sender_unit', 1)
//       break
//     }
//     case 'n_order_by_drafting_unit': {
//       handleSortClick('drafting_unit', 1)
//       break
//     }
//     case 'n_order_by_sender_date': {
//       handleSortClick('sender_date', 1)
//       break
//     }
//     case 'n_order_by_input_user': {
//       handleSortClick('input_user', 1)
//       break
//     }

//   }
// })
// document.getElementById('docList_important_title_container').addEventListener('click', async (e) => {
//   const target = e.target;
//   switch (target.id) {
//     case 'i_order_by_id': {
//       handleSortClick('id', 2)
//       break
//     }
//     case 'i_order_by_title': {
//       handleSortClick('title', 2)
//       break
//     }
//     case 'i_order_by_sender_unit': {
//       handleSortClick('sender_unit', 2)
//       break
//     }
//     case 'i_order_by_drafting_unit': {
//       handleSortClick('drafting_unit', 2)
//       break
//     }
//     case 'i_order_by_sender_date': {
//       handleSortClick('sender_date', 2)
//       break
//     }
//     case 'i_order_by_input_user': {
//       handleSortClick('input_user', 2)
//       break
//     }

//   }
// })


document.getElementById('search-normal').addEventListener('click', async () => {

  // 获取选中的搜索字段
  const searchField = document.getElementById('search_field').value;
  // 获取搜索关键词并处理
  const searchKey = document.getElementById('search_inuput_normal')
    .value
    .trim()
    .toLowerCase();

  // 空关键词处理（显示全部文档）
  if (searchKey === '') {
    refreshDocList(1, null);
    return;
  }


  // 根据选定字段进行过滤
  let filteredDocs = tempListForSearch_Normal.filter(doc => {
    // 全部字段搜索
    if (searchField === 'all') {
      const searchFields = [
        doc.title,
        doc.sender_unit,
        doc.sender_number,
        doc.original_number,
        doc.drafting_unit,
        doc.review_leader,
        doc.input_user,
        doc.secrecy_level,
        doc.crgency_level,
        doc.secrecy_period,
        doc.remarks
      ];

      return searchFields.some(field =>
        String(field).trim() === searchKey
      );
    }
    // 单字段精确匹配
    else {
      // 处理可能为空的字段
      const fieldValue = doc[searchField] ? String(doc[searchField]).trim() : "";
      return fieldValue === searchKey;
    }
  });

  refreshDocList(1, filteredDocs);

})

document.getElementById('search-important').addEventListener('click', async () => {
  const searchKey = document.getElementById('search_inuput_important')
    .value
    .trim()
    .toLowerCase();

  let filteredDocs = tempListForSearch_Important.filter(doc => {
    const searchFields = [
      doc.title,
      doc.sender_unit,
      doc.sender_number,
      doc.drafting_unit,
      doc.review_leader,
      doc.secrecy_level,
      doc.crgency_level,
      doc.secrecy_period
    ];

    // 检查字段是否包含关键词（空关键词返回全部）
    return searchKey === '' ||
      searchFields.some(field =>
        String(field).toLowerCase().includes(searchKey)
      );
  });
  filteredDocs = searchKey == '' ? null : filteredDocs
  refreshDocList(2, filteredDocs, searchKey)
})


// window.addEventListener('click', (e) => {
//   if (e.target === docModal) {
//     docModal.style.display = 'none';
//     docForm.reset();
//   }
// });

// window.addEventListener('resize', () => {
//   const modal = document.getElementById('docModal');
//   if (modal.classList.contains('show')) {
//     // 强制重绘
//     modal.style.display = 'none';
//     setTimeout(() => modal.style.display = 'flex', 10);
//   }
// });


//选择框映射值
const getValidatedSelectValue = (selector) => {
  const select = document.querySelector(selector);
  if (!select) {
    console.error(`找不到选择框元素: ${selector}`);
    throw new Error('表单配置错误');
  }

  const value = select.value.trim();
  if (!value) {
    select.classList.add('input-error');
    throw new Error(`请选择${select.previousElementSibling?.textContent || '必填项'}`);
  }
  select.classList.remove('input-error');
  return value;
};

const getDataSelectValue = (selector) => {
  const select = document.querySelector(selector);
  if (!select) {
    console.warn(`找不到选择框元素: ${selector}`);
    return null;
  }

  const value = select.value.trim();
  if (!value) {
    return null;
  }
  select.classList.remove('input-error');
  return value;
};

/**
 * 编辑功能
 */
let Eidttype; //1普通2重要
let isEditing = false; //编辑模式 disable true不可编辑

let popKeywords = [];
let popnewReview_leaders = [];
let currentEditingId = null; //uuid
let currentEditingDocId = null; //id
let currentEditingTitle = null;

const docModal = document.getElementById('docModal');
// 显示编辑文件模态框
function showEditModal(doc) {
  docModal.style.display = 'block';
  currentEditingId = doc.uuid
  currentEditingDocId = doc.id
  currentEditingTitle = doc.title
  Eidttype = doc.type

  document.getElementById('pop-docTitle').value = doc.title
  document.getElementById('pop-origin_number').value = doc.id
  document.getElementById('pop-sender_number').value = doc.sender_number
  document.getElementById('pop-sender_date').value = doc.sender_date
  document.getElementById('pop-sender_unit').value = doc.sender_unit


  setSelectValue('#pop-secrecy_level', doc.secrecy_level);
  setSelectValue('#pop-secrecy_period', doc.secrecy_period);
  document.getElementById('pop-drafting_unit').value = doc.drafting_unit
  setSelectValue('#pop-crgency_level', doc.crgency_level);
  document.getElementById('pop-remarks').value = doc.remarks

  popKeywords = doc.key_words
  popnewReview_leaders = doc.review_leader ? doc.review_leader.split(',').filter(l => l.trim()) : [];

  if (popKeywords.length > 0) {
    const input = document.getElementById('pop-key_words')
    const container = document.getElementById('pop-key_words_container')

    popKeywords.forEach(it => {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = it.keyword;
      item.querySelector('.alias-tag-delete-btn').style.pointerEvents = 'none';
      item.querySelector('.alias-tag').dataset.item = it
      container.insertBefore(item, input.parentNode);

      // // 清空输入并保持焦点
      // input.value = '';
      // input.focus();
    })
    container.scrollLeft = container.scrollWidth;
  }

  if (popnewReview_leaders.length > 0) {
    const input = document.getElementById('pop-review_leader')
    const container = document.getElementById('pop-review_leader_container')
    popnewReview_leaders.forEach(leader => {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = leader;
      item.querySelector('.alias-tag-delete-btn').style.pointerEvents = 'none';
      container.insertBefore(item, input.parentNode);

      // // 清空输入并保持焦点
      // input.value = '';
      // input.focus();
    })
    // 滚动到最右端
    container.scrollLeft = container.scrollWidth;
  }


}
// 关闭模态框
function hideEditModal() {
  if (isEditing) {
    changeDocEditing()
  }
  docModal.style.display = 'none';
  currentEditingId = null;
  currentEditingDocId = null;
  currentEditingTitle = null;
  Eidttype = null;
  const container = document.getElementById('pop-review_leader_container')
  const tags = container.querySelectorAll('.alias-tag')
  tags.forEach(tag => {
    tag.remove()
  })
  const container2 = document.getElementById('pop-key_words_container')
  const tags2 = container2.querySelectorAll('.alias-tag')
  tags2.forEach(tag => {
    tag.remove()
  })
  document.getElementById('pop-docForm').reset(); // 清空表单


}

function changeDocEditing() {
  //非编辑模式下点击修改UI状态
  const form = document.getElementById('pop-docForm');

  // 切换编辑模式
  form.classList.toggle('editing');

  // 动态切换禁用状.
  isEditing = form.classList.contains('editing');
  const inputs = form.querySelectorAll('input, select');
  document.getElementById('pop-docForm').querySelector('.docModal-actions.primary').textContent = isEditing ? '保存' : '编辑'
  inputs.forEach(input => {
    input.disabled = !isEditing;

    // 特殊处理容器内输入框
    if (input.closest('.pop-input_with_add')) {
      input.style.border = 'none';
      input.parentElement.parentElement.style.borderColor = isEditing ? '#666' : '#ddd';
    }
    if (input.id === 'pop-origin_number') { // 替换成你的实际 ID
      input.disabled = true;
    }
  });
  const labels_closes = form.querySelectorAll('.alias-tag-delete-btn');
  labels_closes.forEach(close => {
    close.style.pointerEvents = isEditing ? 'auto' : 'none';
  })

  // const leadercontainer = document.getElementById('pop-review_leader_container')
  // const closeleader = leadercontainer.querySelectorAll('.alias-tag-delete-btn')
  // closeleader.forEach(item => {
  //   item
  // })
  // popnewReview_leaders.forEach(leader => {
  //   const item = aliastemp.content.cloneNode(true);
  //   item.querySelector('#tag-content').textContent = leader;
  //   item.querySelector('.alias-tag-delete-btn').style.pointerEvents = 'none';
  //   container.insertBefore(item, input.parentNode);

  //   // // 清空输入并保持焦点
  //   // input.value = '';
  //   // input.focus();
  // })
  // const container = document.getElementById('pop-key_words_container')
  // popKeywords.forEach(keyword => {
  //   const item = aliastemp.content.cloneNode(true);
  //   item.querySelector('#tag-content').textContent = keyword;
  //   item.querySelector('.alias-tag-delete-btn').style.pointerEvents = 'none';
  //   container.insertBefore(item, input.parentNode);

  //   // // 清空输入并保持焦点
  //   // input.value = '';
  //   // input.focus();
  // })
  // 处理添加按钮
  const addButtons = form.querySelectorAll('[id^="pop-add_"]');
  addButtons.forEach(btn => btn.disabled = !isEditing);
}

// 修改表单提交处理
document.getElementById('pop-docForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isEditing) {//编辑模式下，再次点击保存
    const data = {

      title: document.getElementById('pop-docTitle').value.trim(),
      sender_number: document.getElementById('pop-sender_number').value.trim(),
      sender_date: document.getElementById('pop-sender_date').value,
      sender_unit: document.getElementById('pop-sender_unit').value.trim(),

      secrecy_level: getValidatedSelectValue('#pop-secrecy_level'),
      secrecy_period: getValidatedSelectValue('#pop-secrecy_period'),
      drafting_unit: document.getElementById('pop-drafting_unit').value.trim(),

      crgency_level: getValidatedSelectValue('#pop-crgency_level'),
      review_leader: popnewReview_leaders.join(','),
      key_words: popKeywords,
      remarks: document.getElementById('pop-remarks').value.trim(),
      uuid: currentEditingId,
      id: currentEditingDocId
    };

    try {
      if (currentEditingId) {
        await window.electronAPI.db.updateDocument(data);
        await refreshDocList(Eidttype);
        await initKeywordTable()
        await loadAudit()
        await loadKeyWordsOptions()
      }
      hideEditModal();
    } catch (_error) {
      //   console.error('保存失败:', error);
      //   // await showinfoDialog('保存失败，请检查控制台');
    }
  } else {
    changeDocEditing()
  }
});
//删除文档
document.getElementById('pop-deleteDoc').addEventListener('click', async (_e) => {
  if (!(await hasPermission())) {
    const cancel = await showPermissionDialog();
    if (!cancel) return;
  }
  const confirm = await showConfirmDialog('确定删除该文件？');
  if (!confirm) return;
  try {
    if (currentEditingId) {
      await window.electronAPI.db.deleteDocument({
        uuid: currentEditingId,
        title: currentEditingTitle
      });
      await refreshDocList(Eidttype);
      await initKeywordTable();
      await loadAudit()
    }
    hideEditModal();
  } catch (_error) {
    //   console.error('保存失败:', error);
    //   // await showinfoDialog('保存失败，请检查控制台');
  }
});


//领导添加  
const popaddNameToLable = document.getElementById('pop-add_review_leader');
const popcontainer = document.getElementById('pop-review_leader_container');
popaddNameToLable.addEventListener('click', async () => {
  const input = document.getElementById('pop-review_leader');
  const value = input.value.trim();

  if (value) {

    const isDuplicate = Array.from(popcontainer.querySelectorAll('#tag-content'))
      .some(span => span.textContent === value);

    if (!isDuplicate) {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = value;

      popcontainer.insertBefore(item, input.parentNode);
      popnewReview_leaders.push(value);

      // 清空输入并保持焦点
      input.value = '';
      input.focus();

      // 滚动到最右端
      popcontainer.scrollLeft = popcontainer.scrollWidth;
    }
  }
})
//关键字添加
const popaddKeyWordsToLable = document.getElementById('pop-add_key_words');
const popkeywordscontainer = document.getElementById('pop-key_words_container');
popaddKeyWordsToLable.addEventListener('click', async () => {
  const keyinput = document.getElementById('pop-key_words');
  const value = keyinput.value.trim();

  if (value) {

    const exists = popKeywords.some(kw => kw.keyword === value);

    if (!exists) {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = value;

      popkeywordscontainer.insertBefore(item, keyinput.parentNode);
      popKeywords.push({
        id: 0, // 0表示新增，未保存到数据库
        keyword: value
      });

      // 清空输入并保持焦点
      keyinput.value = '';
      keyinput.focus();

      // 滚动到最右端
      popkeywordscontainer.scrollLeft = popkeywordscontainer.scrollWidth;
    }
  }
})

//领导标签移除监听
popcontainer.addEventListener('click', async (e) => {
  if (e.target.matches('.alias-tag-delete-btn')) {
    const item = e.target.closest('.alias-tag');
    // 处理未保存的新别名
    const content = item.querySelector('#tag-content').textContent;
    popnewReview_leaders = popnewReview_leaders.filter(a => a !== content);

    item.remove();
  }
})

//关键字标签移除监听
popkeywordscontainer.addEventListener('click', async (e) => {
  if (e.target.matches('.alias-tag-delete-btn')) {

    const item = e.target.closest('.alias-tag');
    const keywordId = parseInt(item.id);

    // 处理未保存的新别名
    const index = popKeywords.findIndex(kw => kw.id === keywordId);
    if (index !== -1) {
      popKeywords.splice(index, 1);
    }

    item.remove();
  }
})

document.getElementById('eidt-close').addEventListener('click', () => {
  hideEditModal();

});
// document.querySelector('#docModal .cancel').addEventListener('click', () => {
//   hideEditModal();
//   document.getElementById('pop-docForm').reset(); // 清空表单
// });
// 添加设置下拉框值的方法
function setSelectValue(selector, value) {
  const select = document.querySelector(selector);
  if (!select) return;

  const option = Array.from(select.options).find(opt => opt.value == value);
  if (option) option.selected = true;
}

async function handleToImportant(docId) {
  try {
    const confirm = await showConfirmDialog('确定转为重要文件吗？', false)
    if (!confirm) return;
    await window.electronAPI.db.convertToImportant(docId);
    // await Promise.all([
    refreshDocList(1)
    refreshDocList(2)
    await loadAudit()
    // ]);
    // await showinfoDialog('转换成功');
  } catch (_err) {
    // await showinfoDialog(`转换失败: ${err.message}`);
  }
}



//添加备注
document.getElementById('anno-add-btn').addEventListener('click', () => {
  showAnnotateAdd()
});
document.getElementById('anno-add-btn-imp').addEventListener('click', () => {
  showAnnotateAdd()
});

// //查看备注
const annotate_look = document.getElementById('annotate_look');
const annotate_add = document.getElementById('annotate_add');
const annotate_edit = document.getElementById('annotate_edit');

const intypeSelect = document.getElementById('annotate-intype');
const annotate_content = document.getElementById('annotate-content');
const mentionList = document.getElementById('mentionList');

intypeSelect?.addEventListener('change', toggleFields);

const intypeEditSelect = document.getElementById('annotate-edit-intype');

const annotateEdit_content = document.getElementById('annotate-edit-content');
const form_row_fenfa = document.getElementById('form_row_dispatch')
const annotateListNor = document.getElementById('annotate-list');
const annotateListImp = document.getElementById('annotate-list-imp');
let currentMentionPos = null;

const contentField = document.getElementById('annotate-content');
const noteField = document.getElementById('annotate-note');

const dispatch_add = document.getElementById('dispatch-unit-add');
const dispatch_input = document.getElementById('dispatch-unit-add-input');
const dispatch_inputwithadd_container = document.getElementById('dispatch-unit-inputwithadd-container');
const dispatch_input_container = document.getElementById('dispatch-unit-container');

// // 模拟数据

function showAnnotateLook() {
  annotate_look.style.display = 'block';
}

function hideAnnotateLook() {
  annotate_look.style.display = 'none';
  currentDocId = null;
  loadAudit();
}

let annoLeaders = [] //存储姓名
let deleteannoIds = [] //存储合并id （仅圈阅）
let isEditingAnno = false;
let annoType = 0; //默认添加
let currentAnnoId = null;
// let annoProcessMode = 1;
let tempListForSearch_Anno = [];
let dispatch_units = [];//分发单位
function changeAnnoEditing() {
  //非编辑模式下点击修改UI状态
  const form = document.getElementById('annotate-edit-Form');

  // 切换编辑模式
  form.classList.toggle('editing');

  // 动态切换禁用状.
  isEditingAnno = form.classList.contains('editing');
  const inputs = form.querySelectorAll('input, select,textarea');
  form.querySelector('.annotate-actions.primary').textContent = isEditingAnno ? '保存' : '编辑'
  // form.querySelector('.annotate-actions.cancel').textContent = '删除'
  inputs.forEach(input => {
    input.disabled = !isEditingAnno;
    // if (input.id === 'annotate-intype') { // 替换成你的实际 ID
    //   input.disabled = true;
    // }
  });
  const labels_closes = form.querySelectorAll('.alias-tag-delete-btn');
  labels_closes.forEach(close => {
    close.style.pointerEvents = isEditingAnno ? 'auto' : 'none';
  })

}
function showAnnotateAdd(haveBg = false) {
  toggleFields();
  annotate_add.style.display = 'block';
  if (haveBg) {
    annotate_add.querySelector('.annotate-bg').style.backgroundColor = 'rgba(0, 0, 0, 0)'
  }
}
function showAnnotateEdit(anno = null) { //类型 0添加 1展示数据  
  annotate_edit.style.display = 'block';
  //annoProcessMode = anno.processing_mode
  currentAnnoId = anno.id

  if (anno) {
    setSelectValue('#annotate-edit-intype', anno.processing_mode);
    //annoLeaders = anno.name;//解析多个标签,仅圈阅的时候解析多个标签 只能删除，不能添加
    document.getElementById('annotate-edit-date').value = anno.annotate_at;
    document.getElementById('annotate-edit-content').value = anno.content;
    document.getElementById('annotate-edit-note').value = anno.annotate_note;
    document.getElementById('fenfa-edit-date').value = anno.distribution_at;
    document.getElementById('annotate-edit-author').value = anno.author;
    if (anno.distribution_scope) {
      const units = anno.distribution_scope.split(',');
      if (units.length > 0) {
        setSelectValue('#primary-edit-unit', units[0]);
      }
      if (units.length > 1) {
        setSelectValue('#secondary-edit-unit', units[1]);
      }
    }
    //禁用状态
    const form = document.getElementById('annotate-edit-Form');

    const inputs = form.querySelectorAll('input, select, textarea');
    form.querySelector('.annotate-actions.primary').textContent = '编辑'

    inputs.forEach(input => {
      input.disabled = true;
      // if (input.id === 'annotate-intype') { // 替换成你的实际 ID
      //   input.disabled = true;
      // }
    });

    // changeAnnoEditing()
  }
  toggleEditFields();
}
function hideAnnotateAdd() {
  annotate_add.style.display = 'none';
  document.getElementById('annotate-Form').reset();
  annotate_date.setDate(new Date());
  document.getElementById('hasAnnotate').textContent = `已有${annotateTemp.length}条备注`;
  loadAudit();
}
function hideAnnotateEdit() {
  if (isEditingAnno) {
    changeAnnoEditing()
  }
  annotate_edit.style.display = 'none';
  document.getElementById('annotate-edit-Form').reset();
  annotate_edit_date.setDate(new Date());
  annotate_edit_fenfa_date.setDate(new Date());
  document.getElementById('hasAnnotate').textContent = `已有${annotateTemp.length}条备注`;
}

function checkTextOverflow() {
  const container = document.getElementById('textContainer');
  const lineHeight = parseInt(getComputedStyle(container).lineHeight);
  const maxHeight = lineHeight * 2; // 两行高度

  // 判断是否溢出
  const isOverflow = container.scrollHeight > maxHeight;
  container.classList.toggle('overflow', isOverflow);
}

async function loadAnnotateList(isSearch = false) {
  let annotations;
  if (!isSearch) {
    if (currentDocId) {
      annotations = await window.electronAPI.db.getAnnotations({
        uuid: currentDocId,
        annotate_type: currentType
      });
    } else {
      annotations = annotateTemp;
    }
    tempListForSearch_Anno = annotations;
  } else {
    annotations = tempListForSearch_Anno;
  }

  const listEl = currentType === 1 ? annotateListNor : annotateListImp;
  listEl.innerHTML = '';
  const template = document.getElementById('annoCardTemplate');

  annotations.forEach(annotate => {
    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.anno-card');
    card.dataset.anno = JSON.stringify(annotate);

    const authorEl = clone.querySelector('.anno-author');
    const dateEl = clone.querySelector('.anno-date');
    const contentEl = clone.querySelector('.annotate-content-container');
    const remarkEl = clone.querySelector('.annotate-remark-container');

    authorEl.textContent = annotate.author;
    dateEl.textContent = annotate.annotate_at;
    contentEl.textContent = annotate.content || '未录入';
    remarkEl.textContent = annotate.annotate_note || '未录入';

    listEl.appendChild(clone);

    applyEllipsis(contentEl, 2);
    applyEllipsis(remarkEl, 1);

    contentEl.addEventListener('click', (e) => {
      if (contentEl.classList.contains('overflow')) {
        contentEl.classList.add('expanded');
        contentEl.classList.remove('overflow');
      }
      e.stopPropagation();
    });

    remarkEl.addEventListener('click', (e) => {
      if (remarkEl.classList.contains('overflow')) {
        remarkEl.classList.add('expanded');
        remarkEl.classList.remove('overflow');
      }
      e.stopPropagation();
    });
  });
}

function applyEllipsis(element, lines) {
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
  const maxHeight = lineHeight * lines;
  if (element.scrollHeight > maxHeight) {
    element.classList.add('overflow');
  }
}

document.getElementById('search-anno').addEventListener('click', async () => {
  const searchKey = document.getElementById('search-anno-input')
    .value
    .trim()
    .toLowerCase();

  let filteredAnno = tempListForSearch_Anno.filter(anno => {
    const searchFields = [
      anno.annotate_at,
      anno.content,
      anno.annotate_note,
      anno.author,
    ];

    return searchKey === '' ||
      searchFields.some(field =>
        String(field).toLowerCase().includes(searchKey)
      );
  });
  filteredAnno = searchKey == '' ? null : filteredAnno
  tempListForSearch_Anno = filteredAnno
  let isSearch = searchKey == '' ? false : true
  loadAnnotateList(isSearch)
});

document.getElementById('search-anno-imp').addEventListener('click', async () => {
  const searchKey = document.getElementById('search-anno-input-imp')
    .value
    .trim()
    .toLowerCase();

  let filteredAnno = tempListForSearch_Anno.filter(anno => {
    const searchFields = [
      anno.annotate_at,
      anno.content,
      anno.annotate_note,
      anno.author,
    ];

    return searchKey === '' ||
      searchFields.some(field =>
        String(field).toLowerCase().includes(searchKey)
      );
  });
  filteredAnno = searchKey == '' ? null : filteredAnno
  tempListForSearch_Anno = filteredAnno
  let isSearch = searchKey == '' ? false : true
  loadAnnotateList(isSearch)
});

function handleAnnotateListDblClick(e) {
  const card = e.target.closest('.anno-card');
  if (card) {
    const annoJson = card.dataset.anno;
    const anno = JSON.parse(annoJson);
    showAnnotateEdit(anno);
  }
}

annotateListNor.addEventListener('dblclick', handleAnnotateListDblClick);
annotateListImp.addEventListener('dblclick', handleAnnotateListDblClick);

annotate_content.normalize();
annotate_content.addEventListener('input', handleInput);
annotate_content.addEventListener('keydown', handleKeyDown);

annotateEdit_content.normalize();
annotateEdit_content.addEventListener('input', handleInputEdit);
annotateEdit_content.addEventListener('keydown', handleKeyDownEdit);

function handleInput(e) {
  const pos = e.target.selectionStart;
  const value = e.target.value;

  // 检测@符号输入
  if (value[pos - 1] === '@') {
    showMentionList(pos);
  }
}

function handleKeyDown(e) {
  if (!mentionList.style.display === 'block') return;

  const items = mentionList.querySelectorAll('.mention-item');
  let active = mentionList.querySelector('.active');

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (!active) items[0].classList.add('active');
      else {
        active.classList.remove('active');
        active.nextElementSibling?.classList.add('active');
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (active) {
        active.classList.remove('active');
        active.previousElementSibling?.classList.add('active');
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (active) selectMention(active.dataset.user);
      break;

    case 'Escape':
      hideMentionList();
      break;
  }
}

function handleInputEdit(e) {
  const pos = e.target.selectionStart;
  const value = e.target.value;

  // 检测@符号输入
  if (value[pos - 1] === '@') {
    showMentionList(pos, 2);
  }
}

function handleKeyDownEdit(e) {
  if (!mentionList.style.display === 'block') return;

  const items = mentionList.querySelectorAll('.mention-item');
  let active = mentionList.querySelector('.active');

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (!active) items[0].classList.add('active');
      else {
        active.classList.remove('active');
        active.nextElementSibling?.classList.add('active');
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (active) {
        active.classList.remove('active');
        active.previousElementSibling?.classList.add('active');
      }
      break;

    case 'Enter':
      e.preventDefault();
      if (active) selectMention(active.dataset.user, 2);
      break;

    case 'Escape':
      hideMentionList();
      break;
  }
}
// 点击外部关闭弹窗
document.addEventListener('click', (e) => {
  if (!mentionList.contains(e.target)) {
    hideMentionList();
  }
});

// 定位配置
const LIST_OFFSET = 5; // 距离右下角的偏移量
function showMentionList(cursorPos, type = 1) {
  let textarea
  if (type == 1) {
    textarea = annotate_content;
  } else {
    textarea = annotateEdit_content;
  }

  const rect = textarea.getBoundingClientRect();
  // 渲染列表
  mentionList.innerHTML = users.map(user =>
    `<div class="mention-item" 
            data-user="${user.name}"
            onclick="selectMention('${user.name}')">
          ${user.name}
      </div>`
  ).join('');
  // 定位到右下角
  mentionList.style.display = 'block';
  mentionList.style.top = `${rect.bottom + window.scrollY - LIST_OFFSET}px`;
  mentionList.style.left = `${rect.right + window.scrollX - mentionList.offsetWidth - LIST_OFFSET}px`;
  currentMentionPos = {
    start: cursorPos,
    end: cursorPos
  };
}
// 选择用户
function selectMention(username, type = 1) {
  if (!currentMentionPos) return;
  let annotate
  if (type === 1) {
    annotate = annotate_content
  } else {
    annotate = annotateEdit_content
  }
  const start = currentMentionPos.start - 1; // 包含@符号
  const end = currentMentionPos.end;

  // 替换内容
  annotate.value =
    annotate.value.slice(0, start) +
    `@${username} ` +  // 自动添加空格
    annotate.value.slice(end);

  // 设置光标位置
  const newPos = start + username.length + 2; // @符号+空格
  annotate.focus();
  annotate.setSelectionRange(newPos, newPos);

  hideMentionList();
}
function hideMentionList() {
  mentionList.style.display = 'none';
  currentMentionPos = null;
}

// 处理方式
function toggleFields() {
  const showFields = intypeSelect?.value;

  if (showFields == "1") {

    contentField.required = true;
    noteField.required = true;
    dispatch_input.disabled = false;
    dispatch_add.disabled = false;
    dispatch_inputwithadd_container.style.backgroundColor = '';
    // 启用字段并重置样式
    contentField.disabled = false;
    noteField.disabled = false;
    contentField.style.backgroundColor = '';
    noteField.style.backgroundColor = '';
    contentField.style.display = '';
    noteField.style.display = '';
  } else if (showFields == "2") {


    dispatch_input.disabled = false;
    dispatch_add.disabled = false;
    dispatch_inputwithadd_container.style.backgroundColor = '';
    // 禁用字段并设置灰色背景
    contentField.disabled = true;
    noteField.disabled = true;

    contentField.style.backgroundColor = '#f0f0f0';
    noteField.style.backgroundColor = '#f0f0f0';
    contentField.style.display = '';
    noteField.style.display = '';

  } else {


    // 禁用字段、设置灰色背景并隐藏
    contentField.disabled = true;
    noteField.disabled = true;
    dispatch_input.disabled = true;
    dispatch_add.disabled = true;
    dispatch_inputwithadd_container.style.backgroundColor = '#f0f0f0';
    contentField.style.backgroundColor = '#f0f0f0';
    noteField.style.backgroundColor = '#f0f0f0';
    contentField.style.display = '';
    noteField.style.display = '';
  }
  // 设置字段必填状态

}

function toggleEditFields() {
  const showFields = intypeEditSelect.value === '1';
  // contentEditGroup.classList.toggle('hidden', !showFields);
  // noteGroup.classList.toggle('hidden', !showFields);
  // if (showFields) {
  //   form_row_fenfa.style.display = 'none'
  // } else {
  // form_row_fenfa.style.display = 'grid'
  // }
  // 设置字段必填状态
  document.getElementById('annotate-edit-content').required = showFields;
  document.getElementById('annotate-edit-note').required = showFields;
}

//批注分发单位标签添加
dispatch_add.addEventListener('click', async () => {

  const value = dispatch_input.value.trim();
  if (value) {
    const exists = globalUnits.some(unit => unit.name === value);
    if (exists) {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = value;
      dispatch_input_container.insertBefore(item, dispatch_input.parentNode);
      dispatch_units.push({
        id: exists.id, // 0表示新增，未保存到数据库
        name: exists.name
      });

      // 清空输入并保持焦点
      dispatch_input.value = '';
      dispatch_input.focus();

      // 滚动到最右端
      dispatch_input_container.scrollLeft = dispatch_input_container.scrollWidth;
    }
  }
})

//分发单位标签移除
dispatch_input_container.addEventListener('click', async (e) => {
  if (e.target.matches('.alias-tag-delete-btn')) {
    const item = e.target.closest('.alias-tag');
    // 处理未保存的新别名
    const content = item.querySelector('#tag-content').textContent;
    dispatch_units = dispatch_units.filter(a => a !== content);

    item.remove();
  }
})

//添加批注表单
document.getElementById('annotate-Form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    // 如果当前文档类型未知，则根据文档ID补全
    if (currentDocId && (currentType === undefined || currentType === null)) {
      const docInfo = await window.electronAPI.db.getDocumentById(currentDocId);
      currentType = docInfo?.doc_type || docInfo?.docType || docInfo?.type || 1;
    }
    let name;
    let authorId;

    name = getValidatedSelectValue('#annotate-author');
    // 检查是否存在同名作者
    const existingAuthors = await window.electronAPI.db.findAuthorsByName(name);

    // 存在则复用，不存在则新建
    if (existingAuthors.length > 0) {
      authorId = existingAuthors[0].id;
    } else {
      const unitInfo = null;
      const newAuthor = await window.electronAPI.db.createAuthor({ name, unit: unitInfo });
      authorId = newAuthor;
    }
    const type = intypeSelect?.value === '1';
    let data;
    const distributionScope = dispatch_units.length > 0
      ? dispatch_units.map(u => u.name).join(',')
      : null;
    if (currentDocId) {
      data = {
        annotate_type: currentType,
        processing_mode: getValidatedSelectValue('#annotate-intype'),
        content: type ? document.getElementById('annotate-content').value.trim() : null,
        annotate_note: type ? document.getElementById('annotate-note').value.trim() : null,
        annotate_at: document.getElementById('annotate-date').value,
        authorId: authorId,
        distribution_scope: distributionScope,
        distribution_at: document.getElementById('fenfa-date')?.value || null,
        uuid: currentDocId
      };

      const result = await window.electronAPI.db.addAnnotation(data);

      if (result.changes > 0) {
        //分发单位表添加
        if (dispatch_units.length > 0) {
          const result1 = await window.electronAPI.db.addDistribution(data);
        }

        loadAnnotateList();
        document.getElementById('annotate-Form').reset();
        dispatch_units = [];
        dispatch_input_container.querySelectorAll('.alias-tag').forEach(tag => tag.remove());
        hideAnnotateAdd();
      }
    } else {
      data = { //新建文档时缓存的批注
        annotate_type: currentType,
        processing_mode: getValidatedSelectValue('#annotate-intype'),
        content: type ? document.getElementById('annotate-content').value.trim() : null,
        annotate_note: type ? document.getElementById('annotate-note').value.trim() : null,
        annotate_at: document.getElementById('annotate-date').value,
        authorId: authorId,
        distribution_scope: distributionScope,
        distribution_at: document.getElementById('fenfa-date')?.value || null,
        uuid: null,
        author: name, //仅在查阅的时候显示
        id: annotateTemp.length
      };
      annotateTemp.push(data);
      loadAnnotateList()
      document.getElementById('annotate-Form').reset();
      dispatch_units = [];
      dispatch_input_container.querySelectorAll('.alias-tag').forEach(tag => tag.remove());
      hideAnnotateAdd();
    }
  } catch (error) {
    console.error('添加批注失败:', error);
    // await showinfoDialog('添加批注失败');
  }

});

//编辑批注表单
document.getElementById('annotate-edit-Form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isEditingAnno) {
    if (currentDocId) {
      // 如果当前文档类型未知，则根据文档ID补全
      if (currentType === undefined || currentType === null) {
        const docInfo = await window.electronAPI.db.getDocumentById(currentDocId);
        currentType = docInfo?.doc_type || docInfo?.docType || docInfo?.type || 1;
      }
      let authorId;
      let name = getValidatedSelectValue('#annotate-edit-author');
      // 检查是否存在同名作者
      const existingAuthors = await window.electronAPI.db.findAuthorsByName(name);

      // 存在则复用，不存在则新建
      if (existingAuthors.length > 0) {
        authorId = existingAuthors[0].id;
      } else {
        const unitInfo = null;
        const newAuthor = await window.electronAPI.db.createAuthor({ name, unit: unitInfo });
        authorId = newAuthor;
      }
      const type = intypeSelect?.value === '1';
      let data;
      if (currentAnnoId) {
        const primaryUnit = getDataSelectValue('#primary-edit-unit');
        const secondaryUnit = getDataSelectValue('#secondary-edit-unit');
        const distributionScope = [primaryUnit, secondaryUnit].filter(Boolean).join(',') || null;
        data = {
          annotate_type: currentType,
          processing_mode: getValidatedSelectValue('#annotate-edit-intype'),
          content: type ? document.getElementById('annotate-edit-content').value.trim() : null,
          annotate_note: type ? document.getElementById('annotate-edit-note').value.trim() : null,
          annotate_at: document.getElementById('annotate-edit-date').value,
          authorId: authorId,
          distribution_scope: distributionScope,
          distribution_at: document.getElementById('fenfa-edit-date').value,
          uuid: currentDocId,
          id: currentAnnoId
        };
        // 调用Electron API
        await window.electronAPI.db.updateAnnotate(data);
      }
      await loadAnnotateList()
      hideAnnotateEdit()
    } else {
      // 检查索引是否存在（避免越界错误）
      if (annotateTemp[currentAnnoId] !== undefined) {
        let authorId;
        let name = getValidatedSelectValue('#annotate-edit-author');
        // 检查是否存在同名作者
        const existingAuthors = await window.electronAPI.db.findAuthorsByName(name);

        // 存在则复用，不存在则新建
        if (existingAuthors.length > 0) {
          authorId = existingAuthors[0].id;
        } else {
          const unitInfo = null;
          const newAuthor = await window.electronAPI.db.createAuthor({ name, unit: unitInfo });
          authorId = newAuthor;
        }
        const type = intypeSelect?.value === '1';
        // 直接修改对象的属性
        annotateTemp[currentAnnoId].annotate_type = currentType;
        annotateTemp[currentAnnoId].processing_mode = getValidatedSelectValue('#annotate-edit-intype');
        annotateTemp[currentAnnoId].content = type ? document.getElementById('annotate-edit-content').value.trim() : null;
        annotateTemp[currentAnnoId].annotate_note = type ? document.getElementById('annotate-edit-note').value.trim() : null;
        annotateTemp[currentAnnoId].annotate_at = document.getElementById('annotate-edit-date').value;
        annotateTemp[currentAnnoId].authorId = authorId;
        const primaryUnitTemp = getDataSelectValue('#primary-edit-unit');
        const secondaryUnitTemp = getDataSelectValue('#secondary-edit-unit');
        annotateTemp[currentAnnoId].distribution_scope = [primaryUnitTemp, secondaryUnitTemp].filter(Boolean).join(',') || null;
        annotateTemp[currentAnnoId].distribution_at = document.getElementById('fenfa-edit-date').value;
        await loadAnnotateList()
        hideAnnotateEdit()
      }
    }
  } else {
    changeAnnoEditing()
  }
});
//删除批注
document.getElementById('annotate-edit-delete').addEventListener('click', async (_e) => {
  if (!(await hasPermission())) {
    const cancel = await showPermissionDialog();
    if (!cancel) return;
  }

  const confirm = await showConfirmDialog('确定删除该条批注？');
  if (!confirm) return;
  if (currentDocId) {
    await window.electronAPI.db.deleteAnnotate(currentAnnoId)
    hideAnnotateEdit()
    loadAnnotateList()
  } else {
    annotateTemp = annotateTemp.filter(obj => obj.id !== currentAnnoId);
    hideAnnotateEdit()
    loadAnnotateList()
  }

})
/**
 * 填充选项 名字
 */
async function loadSelectOptions() {
  try {
    const result = await window.electronAPI.db.getAuthors()

    // 填充呈阅领导
    populateSelect('#review_leader_list', result)
    // 填充密级

    //编辑弹窗填充
    // 填充呈阅领导
    populateSelect('#pop-review_leader_list', result)

    //添加备注名称
    populateSelect('#annotate_author_list', result)

    //缓存user姓名数据
    users = result
  } catch (error) {
    console.error('配置加载失败:', error)
  }
}
async function loadKeyWordsOptions() {
  try {
    const result = await window.electronAPI.db.getKeyWords()

    // 填充呈阅领导
    populateKeySelect('#key_words_list', result)

    globalWordsCatchs = result
  } catch (error) {
    console.error('配置加载失败:', error)
  }
}
async function loadUnit() {
  const units_sons = await window.electronAPI.db.getUnitWithSon();
  loadSelectUnit('add-name-unit', 'add-name-unitSon', units_sons);
  const units = await window.electronAPI.db.getUnits()
  globalUnits = units;
  populateUnitDatalist('#anno-unit-datalist', units)
}
//填充选项 单位
async function loadSelectUnit(primaryId, secondaryId, units, selectedValue = null) {
  try {

    // 解析传入的选中值
    const [targetPrimary, targetSecondary] = selectedValue ?
      selectedValue.split('-') : [null, null];

    if (units == null) {
      units = await window.electronAPI.db.getUnitWithSon();
    }
    const unitHierarchy = units.reduce((acc, unit) => {
      // 确保unitSons是数组格式
      let sons = [];
      if (typeof unit.unitSons === 'string') {
        try {
          sons = JSON.parse(unit.unitSons);
        } catch (e) {
          console.error('unitSons解析失败:', e);
        }
      } else if (Array.isArray(unit.unitSons)) {
        sons = unit.unitSons;
      }

      // 提取子单位名称并存入结构
      acc[unit.name] = sons.map(son => son.unit_son_name);
      return acc;
    }, {});

    // 2. 获取DOM元素
    const primarySelect = document.getElementById(primaryId);
    const secondarySelect = document.getElementById(secondaryId);

    // 3. 初始化主单位选项
    const initPrimaryOptions = () => {
      primarySelect.innerHTML = '<option value="">请选择</option>';
      Object.keys(unitHierarchy).forEach(unitName => {
        primarySelect.add(new Option(unitName, unitName));
      });


      // 设置主单位选中逻辑
      if (targetPrimary && unitHierarchy[targetPrimary]) {
        primarySelect.value = targetPrimary;
        updateSecondaryOptions(targetPrimary, targetSecondary);
      } else if (primarySelect.options.length > 1) {
        // 默认选中第一个（当无传入值时）
        primarySelect.value = Object.keys(unitHierarchy)[0];
        updateSecondaryOptions(Object.keys(unitHierarchy)[0]);
      }
    };

    // 4. 更新子单位选项
    const updateSecondaryOptions = (selectedPrimary, secondary) => {
      secondarySelect.innerHTML = '<option value="">请选择</option>';

      const sons = unitHierarchy[selectedPrimary] || [];
      sons.forEach(sonName => {
        secondarySelect.add(new Option(sonName, sonName));
      });
      // 设置子单位选中
      if (secondary && sons.includes(secondary)) {
        secondarySelect.value = secondary;
      }
    };

    // 5. 事件监听
    primarySelect.addEventListener('change', (e) => {
      updateSecondaryOptions(e.target.value);
    });

    // 6. 初始化
    initPrimaryOptions();

  } catch (error) {
    console.error('配置加载失败:', error);
  }
}

function populateSelect(id, options) {
  const datalist = document.querySelector(id)
  datalist.innerHTML = options.map(opt =>
    `<option value="${opt.name}" data-id="${opt.authorId}"></option>`
  ).join('')
}

function populateKeySelect(id, options) {
  const datalist = document.querySelector(id)
  datalist.innerHTML = options.map(opt =>
    `<option value="${opt.keyword}" data-id="${opt.id}"></option>`
  ).join('')
}

function populateUnitDatalist(id, options) {
  const datalist = document.querySelector(id)
  datalist.innerHTML = options.map(opt =>
    `<option value="${opt.name}" data-id="${opt.id}"></option>`
  ).join('')
}


/**
 * 姓名管理模块
 */
document.getElementById('add-name-btn').addEventListener('click', async (_e) => {
  const name = document.getElementById('add-name-name').value.trim();
  const alias = document.getElementById('add-name-alias').value.trim();
  const unit = document.getElementById('add-name-unit').value.trim();
  const unitSon = document.getElementById('add-name-unitSon').value.trim();
  if (!name || !alias) {
    // await showinfoDialog('姓名和别名不能为空');
    return;
  }

  try {
    // 检查是否存在同名作者
    const existingAuthors = await window.electronAPI.db.findAuthorsByName(name);
    let authorId;

    // 存在则复用，不存在则新建
    if (existingAuthors.length > 0) {
      authorId = existingAuthors[0].id;
    } else {
      let unitInfo;
      if (!unit) {
        unitInfo = null;
      } else {
        if (!unitSon) {
          unitInfo = unit
        } else {
          unitInfo = `${unit}-${unitSon}`
        }
      }
      const newAuthor = await window.electronAPI.db.createAuthor({ name, unit: unitInfo });
      authorId = newAuthor;

    }

    // 添加别名（自动处理唯一性）
    await window.electronAPI.db.addAuthorAlias({
      author_id: authorId,
      author_name: name,
      alias: alias
    });

    // 清空输入并刷新列表
    document.getElementById('add-name-name').value = '';
    document.getElementById('add-name-alias').value = '';
    loadSelectOptions();
    loadAuthorsWithAliasesToNameManager();
  } catch (error) {
    console.error('操作失败:', error);
    // await showinfoDialog(`操作失败: ${error.message}`);
  }

});

async function loadAuthorsWithAliasesToNameManager() {
  const container = document.getElementById('name-list');
  try {
    const authors = await window.electronAPI.db.getAuthorsWithAliases() || [];
    container.replaceChildren();

    authors.forEach(author => {
      let aliases;
      if (typeof author.aliases === 'string') {
        try {
          aliases = JSON.parse(author.aliases);
        } catch (_e) {
          aliases = [];
        }
      } else if (Array.isArray(author.aliases)) {
        aliases = author.aliases; // 直接使用已解析的数组
      } else {
        aliases = [];
      }

      // 克隆模板
      const itemTemplate = document.getElementById('nameListTemplate');
      const clone = itemTemplate.content.cloneNode(true);
      const item = clone.querySelector('.name-list-item');
      item.dataset.id = author.authorId;
      item.dataset.aliases = JSON.stringify(aliases);

      // 填充作者信息
      const authorName = item.querySelector('#name-list-item-name');
      authorName.textContent = author.name || '无名氏';


      // 处理别名
      const aliasContainer = item.querySelector('#name-list-item-alias');
      const aliasNames = aliases.map(item => item.alias)
      const aliasesStr = aliasNames.join(',');
      aliasContainer.textContent = aliasesStr;

      //填充公司
      const unitName = item.querySelector('#name-list-item-unit');
      unitName.textContent = author.unit_name;

      container.appendChild(clone);
    });

  } catch (error) {
    console.error('加载失败:', error);
    showError(container);
  }
}

function showError(container) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = '加载失败，请刷新页面';
  container.appendChild(errorDiv);
}

// 在容器上统一监听点击事件
document.getElementById('name-list').addEventListener('click', async e => {
  // 删除姓名
  if (e.target.matches('#deleteName , #deleteName > img')) {
    if (!(await hasPermission())) {
      const cancel = await showPermissionDialog();
      if (!cancel) return;
    }
    const confirm = await showConfirmDialog('确定删除该姓名？');
    if (!confirm) return;
    try {
      const nameId = e.target.closest('.name-list-item').dataset.id
      await window.electronAPI.db.deleteAuthor(nameId);
      loadAuthorsWithAliasesToNameManager();
      loadAudit()
    } catch (error) {
      console.error('删除失败:', error);
      // await showinfoDialog('删除失败，请检查控制台');
    }
  } else if (e.target.matches('#editName , #editName > img')) {
    const container = e.target.closest('.name-list-item')
    const name = container.querySelector('#name-list-item-name').textContent
    // const alias = container.querySelector('#name-list-item-alias').textContent
    const unit = container.querySelector('#name-list-item-unit').textContent
    const aliases = JSON.parse(container.dataset.aliases || '[]');
    const authorId = container.dataset.id;
    showNameEdit(authorId, name, aliases, unit);
  }
  else {

    const container = e.target.closest('.name-list-item')
    const name = container.querySelector('#name-list-item-name').textContent
    // const alias = container.querySelector('#name-list-item-alias').textContent
    const unit = container.querySelector('#name-list-item-unit').textContent
    const aliases = JSON.parse(container.dataset.aliases || '[]');
    const authorId = container.dataset.id;
    showNameEdit(authorId, name, aliases, unit);

  }
});

let tempDeleteAliasIds = new Set();
let newAliases = [];
let currentAuthorId = null; // 用于保存当前编辑的作者ID
let isNameEditing = false;
const nameinput = document.getElementById('name-edit-name')
const container = document.getElementById('name-edit-alias-container')
// const primaryUnit = document.getElementById('name-edit-primary-unit')
// const secondaryUnit = document.getElementById('name-edit-secondary-unit')
const aliastemp = document.getElementById('alias-tag-item')

async function showNameEdit(authorId, name, aliases, unit) {
  currentAuthorId = authorId;
  isEditing = false;
  // 清空缓存
  tempDeleteAliasIds.clear();
  newAliases = [];

  document.getElementById('nameEidt').style.display = 'block';
  //填充信息

  const units = await window.electronAPI.db.getUnitWithSon();
  loadSelectUnit('name-edit-primary-unit', 'name-edit-secondary-unit', units, unit);
  nameinput.value = name;

  if (aliases.length > 0) {
    const input = document.getElementById('name-edit-add-input')

    aliases.forEach(it => {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = it.alias;
      item.querySelector('.alias-tag-delete-btn').style.pointerEvents = 'none';
      item.querySelector('.alias-tag').dataset.id = it.id
      container.insertBefore(item, input.parentNode);
    })
    container.scrollLeft = container.scrollWidth;
  }
}

// 保存处理
document.getElementById('edit-save-name').addEventListener('click', async () => {
  if (!isNameEditing) {
    changeNameEditing();
  } else {
    const name = document.getElementById('name-edit-name').value.trim();
    const primaryUnit = document.getElementById('name-edit-primary-unit').value;
    const secondaryUnit = document.getElementById('name-edit-secondary-unit').value;

    // 组合单位
    const fullUnit = [primaryUnit, secondaryUnit].filter(Boolean).join('-');

    // 调用数据库更新

    await window.electronAPI.db.updateAuthor({
      authorId: currentAuthorId,
      newName: name,
      newUnit: fullUnit,
      newAliases,
      deleteAliasIds: Array.from(tempDeleteAliasIds)
    });

    loadAuthorsWithAliasesToNameManager()
    // 关闭弹窗
    hideNameEdit()
  }

});

function changeNameEditing() {
  const nameEidt = document.getElementById('nameEidt');
  //非编辑模式下点击修改UI状态
  nameEidt.classList.toggle('editing');

  // 动态切换禁用状.
  isNameEditing = nameEidt.classList.contains('editing');

  const inputs = nameEidt.querySelectorAll('input, select');
  inputs.forEach(input => {
    input.disabled = !isNameEditing;
    // 特殊处理容器内输入框
    if (input.closest('.input_with_add')) {
      input.style.border = 'none';
      input.parentElement.parentElement.style.borderColor = isNameEditing ? '#666' : '#ddd';
    }
  });

  document.getElementById('edit-save-name').textContent = isNameEditing ? '保存' : '编辑'

  const aliasContainer = document.getElementById('name-edit-alias-container')
  const labels_closes = aliasContainer.querySelectorAll('.alias-tag-delete-btn');
  labels_closes.forEach(close => {
    close.style.pointerEvents = isNameEditing ? 'auto' : 'none';
  })
  const addButtons = document.getElementById('name-edit-add-btn')
  addButtons.disabled = !isNameEditing
}

// 添加别名处理
document.getElementById('name-edit-add-btn').addEventListener('click', () => {
  const input = document.getElementById('name-edit-add-input');
  const value = input.value.trim();

  if (value) {

    const aliasContainer = document.getElementById('name-edit-alias-container');
    const isDuplicate = Array.from(aliasContainer.querySelectorAll('#tag-content'))
      .some(span => span.textContent === value);

    if (!isDuplicate) {
      const item = aliastemp.content.cloneNode(true);
      item.querySelector('#tag-content').textContent = value;
      aliasContainer.insertBefore(item, input.parentNode);
      newAliases.push(value);
      input.value = '';
    }
  }
});
//别名标签移除
document.getElementById('name-edit-alias-container').addEventListener('click', async (e) => {
  if (e.target.matches('.alias-tag-delete-btn')) {
    const item = e.target.closest('.alias-tag');
    const aliasId = item.dataset.id;

    if (aliasId) {
      tempDeleteAliasIds.add(aliasId);
    } else {
      // 处理未保存的新别名
      const content = item.querySelector('#tag-content').textContent;
      newAliases = newAliases.filter(a => a !== content);
    }

    item.remove();
  }
})

function hideNameEdit() {
  if (isNameEditing) {
    changeNameEditing()
  }
  currentAuthorId = null;
  // 清空缓存
  tempDeleteAliasIds.clear();
  newAliases = [];
  const container = document.getElementById('name-edit-alias-container')
  const tags = container.querySelectorAll('.alias-tag')
  tags.forEach(tag => {
    tag.remove()
  })
  document.getElementById('nameEidt').style.display = 'none';
}
document.getElementById('nameEdit-close').addEventListener('click', async (_e) => {
  hideNameEdit()
})

//删除姓名
document.getElementById('delete-name-eidt').addEventListener('click', async (e) => {
  if (!(await hasPermission())) {
    const cancel = await showPermissionDialog();
    if (!cancel) return;
  }
  const confirm = await showConfirmDialog('确定删除该姓名？');
  if (!confirm) return;
  try {
    const nameId = currentAuthorId
    await window.electronAPI.db.deleteAuthor(nameId);
    hideNameEdit()
    loadAuthorsWithAliasesToNameManager();
    loadAudit()
  } catch (error) {
    console.error('删除失败:', error);
    // await showinfoDialog('删除失败，请检查控制台');
  }
})

function showInfo(title, name, alias, unit) {
  document.getElementById('nameinfo').style.display = 'block';

  document.getElementById('name-info-title').textContent = title;
  document.getElementById('name-info-name').textContent = name;
  document.getElementById('name-info-alias').textContent = alias;
  document.getElementById('name-info-unit').textContent = unit;

}
// function hideNameInfo() {
//   document.getElementById('nameinfo').style.display = 'none';
// }
// document.getElementById('nameinfo-close').addEventListener('click', async (_e) => {
//   hideNameInfo()
// })

/**
 * 单位管理模块
 */
document.getElementById('add-unit-btn').addEventListener('click', async (_e) => {
  const name = document.getElementById('add-unit-unit').value.trim();
  const unitSon = document.getElementById('add-unit-unitSon').value.trim();

  if (!name || !unitSon) {
    return;
  }

  try {
    // 检查是否存在同名单位
    const existingUnit = await window.electronAPI.db.findUnitByName(name);
    let unitId;

    // 存在则复用，不存在则新建
    if (existingUnit.length > 0) {
      unitId = existingUnit[0].id;
    } else {
      const newUnit = await window.electronAPI.db.createUnit({ name });
      unitId = newUnit;
    }

    // 添加二级单位（自动处理唯一性）
    await window.electronAPI.db.addUnitSon({
      unit_id: unitId,
      unit_son_name: unitSon
    });

    // 清空输入并刷新列表
    document.getElementById('add-unit-unit').value = '';
    document.getElementById('add-unit-unitSon').value = '';
    //更新选择器
    loadUnit();
    //更新列表
    loadUnitWithSonToUnitManager();
  } catch (error) {
    console.error('操作失败:', error);
    alert(`操作失败: ${error.message}`);
  }

});


// 加载姓名树形结构
async function loadUnitWithSonToUnitManager() {
  const container = document.getElementById('unit-list');
  try {
    const units = await window.electronAPI.db.getUnitWithSonToManager() || [];
    container.replaceChildren();

    units.forEach(unit => {
      // 处理子单元数据结构
      let unitsSon;
      const sonSource = unit.unitSon; // 确保字段名正确
      if (typeof sonSource === 'string') {
        try { unitsSon = JSON.parse(sonSource) }
        catch (_e) { unitsSon = [] }
      } else {
        // 兼容单对象和数组
        unitsSon = Array.isArray(sonSource) ? sonSource : [sonSource].filter(Boolean)
      }

      // 克隆模板
      const clone = document.getElementById('unitListTemplate').content.cloneNode(true);
      const item = clone.querySelector('.unit-list-item');
      item.dataset.id = unit.unitSon.id;//子单位ID
      item.dataset.unit = JSON.stringify(unit);;//子单位ID
      // 渲染主单元
      item.querySelector('#unit-list-item-name').textContent = unit.name || '无';

      // 渲染子单元（即使单对象也通过数组处理）
      const sonNames = unitsSon.map(item => item.unit_son_name).join(', ');
      item.querySelector('#unit-list-item-son').textContent = sonNames || '无子单元';

      container.appendChild(clone);
    });
  } catch (error) {
    console.error('加载失败:', error);
    showError(container);
  }
}

// 在容器上统一监听点击事件
document.getElementById('unit-list').addEventListener('click', async e => {
  // 删除单位
  if (e.target.matches('#deleteUnit, #deleteUnit > img')) {
    if (!(await hasPermission())) {
      const cancel = await showPermissionDialog();
      if (!cancel) return;
    }
    const confirm = await showConfirmDialog('确定删除该单位？');
    if (!confirm) return;
    try {
      const unitSonId = e.target.closest('.unit-list-item').dataset.id
      await window.electronAPI.db.deleteUnitSon(unitSonId);
      loadUnitWithSonToUnitManager();
      loadAudit()
    } catch (error) {
      console.error('删除失败:', error);
      // await showinfoDialog('删除失败，请检查控制台');
    }
  } else if (e.target.matches('#editUnit, #editUnit > img')) {
    const unit = e.target.closest('.unit-list-item').dataset.unit
    showUnitEidt(unit)
  } else {
    const unit = e.target.closest('.unit-list-item').dataset.unit
    showUnitEidt(unit)
  }
});

//单位编辑
let currentUnitId = null
let currentUnitSonId = null
let isUintEidting = false
function showUnitEidt(unit) {
  const tempunit = JSON.parse(unit);
  currentUnitId = tempunit.unitId
  currentUnitSonId = tempunit.unitSon.id
  document.getElementById('unitEdit').style.display = 'block'

  document.getElementById('unit-edit-primary-unit').value = tempunit.name
  document.getElementById('unit-edit-secondary-unit').value = tempunit.unitSon.unit_son_name
}

document.getElementById('save-unit-eidt').addEventListener('click', async (_e) => {

  if (!isUintEidting) {
    changeUnitEditing();
  } else {
    const newUnitName = document.getElementById('unit-edit-primary-unit').value
    const newUnitSonName = document.getElementById('unit-edit-secondary-unit').value
    const unitSon = { currentUnitSonId, newUnitSonName }
    const array = [unitSon];
    await window.electronAPI.db.updateUnitWithSons({
      unitId: currentUnitId,
      newName: newUnitName,
      newUnitSons: array
    })
    loadUnitWithSonToUnitManager()
    hideUnitEidt()
  }

});

function changeUnitEditing() {
  const unitEdit = document.getElementById('unitEdit');
  //非编辑模式下点击修改UI状态
  unitEdit.classList.toggle('editing');

  // 动态切换禁用状.
  isUintEidting = unitEdit.classList.contains('editing');
  const inputs = unitEdit.querySelectorAll('input');
  inputs.forEach(input => {
    input.disabled = !isUintEidting;
  });

  document.getElementById('save-unit-eidt').textContent = isUintEidting ? '保存' : '编辑'

}

document.getElementById('delete-unit-eidt').addEventListener('click', async (_e) => {

  if (!(await hasPermission())) {
    const cancel = await showPermissionDialog();
    if (!cancel) return;
  }
  const confirm = await showConfirmDialog('确定删除该单位？');
  if (!confirm) return;
  try {
    const unittUnitId = currentUnitId
    await window.electronAPI.db.deleteUnit(unittUnitId);
    loadUnitWithSonToUnitManager();
    loadAudit()
    hideUnitEidt()
  } catch (error) {
    console.error('删除失败:', error);
    // await showinfoDialog('删除失败，请检查控制台');
  }


})
function hideUnitEidt() {
  if (isUintEidting) {
    changeUnitEditing()
  }

  currentUnitId = null
  currentUnitSonId = null
  document.getElementById('unitEdit').style.display = 'none'
}
document.getElementById('unitEdit-close').addEventListener('click', async (_e) => {
  hideUnitEidt();
})

//数据审计
async function loadAudit() {
  const container = document.getElementById('audit-List');
  try {
    const audits = await window.electronAPI.db.getOperations() || [];
    container.replaceChildren();

    audits.forEach(audit => {

      // 克隆模板
      const clone = document.getElementById('auditListTemplate').content.cloneNode(true);
      const item = clone.querySelector('#doc_list_item');

      // 获取操作时间（可能是时间戳毫秒数或ISO字符串）
      const operationTime = audit.operation_time;

      // 创建日期对象
      const dateObj = new Date(operationTime);
      // 格式化日期为本地字符串
      const formattedDate = isNaN(dateObj.getTime())
        ? '无'
        : dateObj.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

      // 渲染主单元
      item.querySelector('#audit-date').textContent = formattedDate;
      item.querySelector('#audit-operator').textContent = audit.operator || '无';
      item.querySelector('#audit-detail').textContent = audit.details;

      container.appendChild(clone);
    });
  } catch (error) {
    console.error('加载失败:', error);
    showError(container);
  }
}

//关键词管理
async function initKeywordTable() {
  const table = document.getElementById('keyword-list');
  const keywordlist = await window.electronAPI.db.getKeyWordsAll();
  table.setData(keywordlist);
  table.addEventListener('row-click', (event) => {
    const keyword_id = event.detail.data.id;

    const leftContainer = document.querySelector('.keyword-left');
    const rightContainer = document.querySelector('.keyword-right');

    // 添加动画类
    leftContainer.classList.add('split-view');
    // 先显示右侧面板（设置为 flex）
    rightContainer.style.display = 'flex';
    // 强制重绘（确保动画流畅）
    void rightContainer.offsetHeight;
    // 填充右侧详情
    fillKeywordDetail(keyword_id);

  });

}
document.getElementById('shink-keyword').addEventListener('click', async (_e) => {
  const leftContainer = document.querySelector('.keyword-left');
  const rightContainer = document.querySelector('.keyword-right');

  // 添加强制隐藏的 CSS 类
  rightContainer.classList.add('force-hidden');
  // 移除active类开始收缩动画
  rightContainer.classList.remove('active');

  // 监听动画结束事件
  setTimeout(() => {
    rightContainer.style.display = 'none';
    rightContainer.classList.remove('force-hidden');
  }, 400);

  // 恢复左侧全屏宽度
  leftContainer.classList.remove('split-view');
})

async function fillKeywordDetail(keyword_id) {
  const data = await window.electronAPI.db.getDocumentsByKeywordId(keyword_id);
  const tbody = document.getElementById('keyword-detail-tbody');
  tbody.innerHTML = ''; // 清空现有内容

  data.forEach((doc, index) => {
    const row = document.createElement('tr');

    // 序号列
    const indexCell = document.createElement('td');
    indexCell.textContent = index + 1;

    // 文档名称列
    const nameCell = document.createElement('td');
    nameCell.textContent = doc.title;

    row.appendChild(indexCell);
    row.appendChild(nameCell);
    tbody.appendChild(row);
  });
}

// 窗口
async function showConfirmDialog(msg) {
  return new Promise((resolve) => {
    const mask = document.getElementById('dialog-mask')
    const dialog_close = document.getElementById('dialog-close')
    const cancelBtn = document.getElementById('cancelBtn')
    const confirmBtn = document.getElementById('confirmBtn')
    const dialog_msg = document.getElementById('dialog-msg')

    dialog_msg.textContent = msg

    // 激活弹窗
    setTimeout(() => {
      mask.style.display = 'flex'
    }, 10);

    // 关闭按钮事件
    dialog_close.addEventListener('click', () => {
      closeDialog(false);
    });

    // 取消按钮事件
    cancelBtn.addEventListener('click', () => {
      closeDialog(false);
    });

    // 确认按钮事件
    confirmBtn.addEventListener('click', () => {
      closeDialog(true);
    });

    // // 点击遮罩关闭
    // mask.addEventListener('click', (e) => {
    //   if (e.target === mask) {
    //     closeDialog(false);
    //   }
    // });

    // 关闭弹窗函数
    function closeDialog(result) {
      mask.style.display = 'none'
      setTimeout(() => {
        resolve(result);
      }, 300);
    }
  });
}


async function _showinfoDialog(msg) {
  const result = await window.electronAPI.showDialog(msg);
  return result === 'confirm';
}

async function showPermissionDialog() {
  const result = await window.electronAPI.showDialog({ message: '您没有权限执行当前操作', showNotice: true });//返回confirm/cancel/close
  console.log('result == ' + result)
  return false;
}

async function hasPermission() {
  const level = await window.electronAPI.getLevel();
  return level == 1
}

async function loadSetting() {
  document.getElementById('userName').textContent = await window.electronAPI.getCurrentAcconutName()
  document.getElementById('login-out').addEventListener('click', async () => {
    const confirm = await showConfirmDialog('确定要退出吗？', true);
    if (!confirm) return;
    window.electronAPI.close()
  })
}

function showToast(text, duration = 2000) {
  const toast = document.createElement('div');
  toast.textContent = text;
  toast.style.cssText = `
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 9999;
    animation: fadeInOut ${duration}ms;
  `;

  // 动画关键帧
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; bottom: 0; }
      10% { opacity: 1; bottom: 20px; }
      90% { opacity: 1; bottom: 20px; }
      100% { opacity: 0; bottom: 0; }
    }
  `;
  document.head.appendChild(styleSheet);

  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}