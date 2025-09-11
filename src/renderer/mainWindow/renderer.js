// 初始化日期选择器
const datePicker = flatpickr("#annotate-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

const fenfa_datePicker = flatpickr("#fenfa-date", {
  dateFormat: "Y-m-d",
  locale: "zh", // 需要额外引入中文语言包
  defaultDate: new Date()
});

let users

document.addEventListener('DOMContentLoaded', () => {
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
  const settingBtn = getElement('setting')
  const minimizeBtn = getElement('minimize')
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
  // 关闭按钮
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[事件] 点击关闭按钮')
      window.electronAPI.close()
    })
  }
  if (settingBtn) {
    settingBtn.addEventListener('click', () => {
      showConfigModal()
    })
  }


  // 修改后的标签切换逻辑
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
      });

      btn.classList.add('active');
      targetContent.classList.add('active');
    });
  });

  /**
   * 创建文档（普通、重要）
   */
  const docForm = document.getElementById('newDoc-docForm');
  docForm.addEventListener('submit', async (e) => {
    e.preventDefault();// 阻止默认提交行为（页面跳转）


    const submitter = e.submitter;
    const docType = submitter?.value || 'normal'; // 默认值

    const data = {
      doc_type: docType === "normal" ? 1 : 2,
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

    try {
      let docId

      docId = await window.electronAPI.db.createDocument(data);

      if (docId) { // 判断是否返回有效ID
        docForm.reset(); // 清空表单
        
        if (docType === 'important') {
          await refreshDocList_important();
        } else {
          await refreshDocList_normal(); // 刷新文档列表
        }
      }
    } catch (error) { // 错误处理
      console.error('创建文档失败:', error); // 控制台输出详细错误
      alert('文档创建失败，请检查控制台！');
    }
  })


  //普通文件列表
  const docList_normal = document.getElementById('docList-normal');
  // 普通文件事件委托处理所有按钮点击
  docList_normal.addEventListener('click', async (e) => {
    const docItem = e.target.closest('.doc-item');
    if (!docItem) return;

    const docId = docItem.dataset.id;
    const btn = e.target.closest('.action-btn');

    if (btn) {
      if (btn.classList.contains('edit-btn')) {
        await handleEditDoc(docId, 1);
      } else if (btn.classList.contains('toimportant-btn')) {
        //转为重要文件
        await handleToImportant(docId);
      } else if (btn.classList.contains('annotate-btn')) {
        await handleAddAnnotation(docId, 1);
      } else if (btn.classList.contains('delete-btn')) {
        await handleDeleteDoc(docId, 1);
      }
      return;
    }
    //添加item点击事件
    await showDocDetail(docId);

  });

  //重要文件列表
  const docList_important = document.getElementById('docList-important');
  // 重要文件事件委托处理所有按钮点击
  docList_important.addEventListener('click', async (e) => {
    const docItem = e.target.closest('.doc-item-important');
    if (!docItem) return;

    const docId = docItem.dataset.id;
    const btn = e.target.closest('.action-btn');

    if (btn) {
      if (btn.classList.contains('edit-btn')) {
        await handleEditDoc(docId, 2);
      } else if (btn.classList.contains('annotate-btn')) {
        await handleAddAnnotation(docId, 2);
      } else if (btn.classList.contains('delete-btn')) {
        await handleDeleteDoc(docId, 2);
      }
      return;
    }
    //添加item点击事件
    await showDocDetail(docId, 2);

  });

  /**
   * 刷新列表
   */
  refreshDocList_normal()
  //加一个重要列表
  refreshDocList_important()

  //加载创建文档时配置
  loadSelectOptions()
  //加载创建备注时配置
  loadSelectAnnotate()
  loadAuthorsWithAliases()
  loadUnitWithSon()

  //备注处理方式
  toggleFields();
  intypeSelect.addEventListener('change', toggleFields);

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
        formData.drafting_unit == "" ||
        formData.title == "" ||
        formData.review_leader == "" ||
        formData.secrecy_level == "" ||
        formData.crgency_level == "" ||
        formData.secrecy_period == "") {
        //弹窗
        return;
      }

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
        `原文号：${formData.original_number}`,
        `制文单位：${formData.drafting_unit}`,
        `文件标题：${formData.title}`,
        `呈阅领导：${formData.review_leader}`,
        `密    级：${formData.secrecy_level}`,
        `紧急程度：${formData.crgency_level}`,
        `保密期限：${formData.secrecy_period}`
      ].join('\n'); // 使用换行符分隔

      // 生成并保存文档
      const result = await window.electronAPI.generateAndExport({
        text: barcodeText,        // 字段名必须与工具类匹配
        outputPath: savePath,
        title: formData.title || "未命名文档",    // 添加文档标题
        imageWidth: 500 // 可选附加文本
      });
      if (result.success) {
        alert(`文档已保存至：${result.path}`);
      }
    } catch (error) {
      console.error('文档生成失败:', error);
      alert(`保存失败: ${error.message}`);
    }

  });

  //备注取消监听
  document.querySelector('#annotate .cancel').addEventListener('click', () => {
    hideAnnotate();
  });
})



let currentDocId = null
async function refreshDocList_normal() {
  try {
    const docs = await window.electronAPI.db.getDocumentsByType(1)
    const container = document.getElementById('docList-normal');
    const template = document.getElementById('docItemTemplate');

    // 清空现有列表
    container.innerHTML = '';

    docs.forEach(doc => {
      // 处理可能的解密错误
      const safeDecrypt = (value) => {
        try {
          return value || '[数据缺失]';
        } catch {
          return '[解密失败]';
        }
      };

      // 克隆模板
      const clone = template.content.cloneNode(true);
      const item = clone.querySelector('.doc-item');

      // 设置数据属性
      item.dataset.id = doc.uuid;

      // 填充数据
      clone.querySelector('.doc-title').textContent = safeDecrypt(doc.title);
      clone.querySelector('.doc-date').textContent = new Date(doc.created_at).toLocaleDateString();

      clone.querySelector('.doc-sender_unit').textContent = `来文单位：${safeDecrypt(doc.sender_unit)}`;
      clone.querySelector('.doc-sender_number').textContent = `来文编号：${safeDecrypt(doc.sender_number)}`;
      clone.querySelector('.doc-original_number').textContent = `原文号：${safeDecrypt(doc.original_number)}`;
      clone.querySelector('.doc-drafting_unit').textContent = `制文单位：${safeDecrypt(doc.drafting_unit)}`;

      container.appendChild(clone);
    });

  } catch (error) {
    console.error('刷新文档列表失败:', error);
  }
}

async function refreshDocList_important() {
  try {
    const docs = await window.electronAPI.db.getDocumentsByType(2)
    const container = document.getElementById('docList-important');
    const template = document.getElementById('docItemTemplate-important');

    // 清空现有列表
    container.innerHTML = '';

    docs.forEach(doc => {
      // 处理可能的解密错误
      const safeDecrypt = (value) => {
        try {
          return value || '[数据缺失]';
        } catch {
          return '[解密失败]';
        }
      };

      // 克隆模板
      const clone = template.content.cloneNode(true);
      const item = clone.querySelector('.doc-item-important');

      // 设置数据属性
      item.dataset.id = doc.uuid;

      // 填充数据
      clone.querySelector('.doc-title-important').textContent = safeDecrypt(doc.title);
      clone.querySelector('.doc-date-important').textContent = new Date(doc.created_at).toLocaleDateString();

      clone.querySelector('.doc-sender_unit-important').textContent = `来文单位：${safeDecrypt(doc.sender_unit)}`;
      clone.querySelector('.doc-sender_number-important').textContent = `来文编号：${safeDecrypt(doc.sender_number)}`;
      clone.querySelector('.doc-original_number-important').textContent = `原文号：${safeDecrypt(doc.original_number)}`;
      clone.querySelector('.doc-drafting_unit-important').textContent = `制文单位：${safeDecrypt(doc.drafting_unit)}`;

      container.appendChild(clone);
    });

  } catch (error) {
    console.error('刷新文档列表失败:', error);
  }
}


let currentEditingId = null;
window.addEventListener('click', (e) => {
  if (e.target === docModal) {
    docModal.style.display = 'none';
    docForm.reset();
  }
});

window.addEventListener('resize', () => {
  const modal = document.getElementById('docModal');
  if (modal.classList.contains('show')) {
    // 强制重绘
    modal.style.display = 'none';
    setTimeout(() => modal.style.display = 'flex', 10);
  }
});


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



/**
 * 编辑功能
 */
let Eidttype; //1普通2重要
const docModal = document.getElementById('docModal');
// 显示编辑模态框
function showEditModal() {
  docModal.style.display = 'block';
}
// 关闭模态框
function hideEditModal() {
  docModal.style.display = 'none';
  currentEditingId = null;
}

// 修改编辑按钮处理逻辑(普通)
async function handleEditDoc(docId, type) {

  let doc;
  try {
    doc = await window.electronAPI.db.getDocumentById(docId);

    currentEditingId = docId;

    // 填充表单数据
    document.getElementById('pop-docTitle').value = doc.title;
    document.getElementById('pop-sender_unit').value = doc.sender_unit;
    document.getElementById('pop-sender_number').value = doc.sender_number;
    document.getElementById('pop-original_number').value = doc.original_number;
    document.getElementById('pop-drafting_unit').value = doc.drafting_unit;

    // 设置下拉框选中状态
    setSelectValue('#pop-review_leader', doc.review_leader);
    setSelectValue('#pop-secrecy_level', doc.secrecy_level);
    setSelectValue('#pop-crgency_level', doc.crgency_level);
    setSelectValue('#pop-secrecy_period', doc.secrecy_period);
    Eidttype = type
    showEditModal()
  } catch (error) {
    console.error('获取文档失败:', error);
    alert('无法加载文档，请检查控制台');
  }
}
// 修改表单提交处理
document.getElementById('pop-docForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    title: document.getElementById('pop-docTitle').value.trim(),
    sender_unit: document.getElementById('pop-sender_unit').value.trim(),
    sender_number: document.getElementById('pop-sender_number').value.trim(),
    original_number: document.getElementById('pop-original_number').value.trim(),
    drafting_unit: document.getElementById('pop-drafting_unit').value.trim(),

    review_leader: getValidatedSelectValue('#pop-review_leader'),
    secrecy_level: getValidatedSelectValue('#pop-secrecy_level'),
    crgency_level: getValidatedSelectValue('#pop-crgency_level'),
    secrecy_period: getValidatedSelectValue('#pop-secrecy_period'),
    uuid: currentEditingId
  };

  try {
    if (currentEditingId) {
      await window.electronAPI.db.updateDocument(data);
      if (Eidttype == 1) {
        await refreshDocList_normal();
      } else {
        await refreshDocList_important();
      }
    }

    hideEditModal();
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败，请检查控制台');
  }
});

document.querySelector('#docModal .cancel').addEventListener('click', () => {
  hideEditModal();
  document.getElementById('pop-docForm').reset(); // 清空表单
});
// 添加设置下拉框值的方法
function setSelectValue(selector, value) {
  const select = document.querySelector(selector);
  if (!select) return;

  const option = Array.from(select.options).find(opt => opt.value === value);
  if (option) option.selected = true;
}



/**
 * 删除功能
 */
async function handleDeleteDoc(docId, type = 1) {
  if (confirm('确定要永久删除此文档吗？')) {
    let result
    try {
      result = await window.electronAPI.db.deleteDocument(docId);
      if (result.success) {
        if (type == 1) {
          await refreshDocList_normal();
        } else {
          await refreshDocList_important();
        }
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('文档删除失败');
    }
  }
}

async function handleToImportant(docId) {
  try {
    await window.electronAPI.db.convertToImportant(docId);
    await Promise.all([
      refreshDocList_normal(),
      refreshDocList_important()
    ]);
    alert('转换成功');
  } catch (err) {
    alert(`转换失败: ${err.message}`);
  }
}


/**
 * 添加批注功能
 */
let currentType = 1
async function handleAddAnnotation(docId, type = 1) {
  currentDocId = docId
  currentType = type
  showAnnotate()
}

/**
 * 添加批注功能
 */
const annotate = document.getElementById('annotate');
const annotate_note = document.getElementById('annotate-note');
const intypeSelect = document.getElementById('annotate-intype');
const contentGroup = document.querySelector('#annotate-content').closest('.form-group');
const annotate_content = document.getElementById('annotate-content');
const noteGroup = document.querySelector('#annotate-note').closest('.form-group');
const mentionList = document.getElementById('mentionList');
const form_row_fenfa = document.querySelector('.annotate-form-row')
let currentMentionPos = null;

// 模拟数据

function showAnnotate() {
  toggleFields();
  annotate.style.display = 'block';
}
function hideAnnotate() {
  annotate.style.display = 'none';
  document.getElementById('annotate-Form').reset();
  currentDocId = null;
}



annotate_content.normalize();

annotate_content.addEventListener('input', handleInput);
annotate_content.addEventListener('keydown', handleKeyDown);

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
// 点击外部关闭弹窗
document.addEventListener('click', (e) => {
  if (!mentionList.contains(e.target)) {
    hideMentionList();
  }
});
function showMentionList(cursorPos) {
  // 计算定位
  const mirror = document.createElement('div');
  mirror.style.cssText = `
      position: absolute;
      white-space: pre;
      visibility: hidden;
      font: ${getComputedStyle(annotate_content).font};
      padding: ${getComputedStyle(annotate_content).padding}
  `;

  document.body.appendChild(mirror);

  // 测量文本宽度
  const textBeforeAt = annotate_content.value.slice(0, cursorPos - 1);
  mirror.textContent = textBeforeAt;
  const textWidth = mirror.offsetWidth;

  // 获取定位
  const inputRect = annotate_content.getBoundingClientRect();
  const top = inputRect.top + inputRect.height + window.scrollY + 5;
  const left = inputRect.left + textWidth + window.scrollX;

  // 渲染列表
  mentionList.innerHTML = users.map(user =>
    `<div class="mention-item" 
            data-user="${user.name}"
            onclick="selectMention('${user.name}')">
          ${user.name}
      </div>`
  ).join('');

  // 应用定位
  mentionList.style.top = `${top}px`;
  mentionList.style.left = `${left}px`;
  mentionList.style.display = 'block';

  // 记录位置
  currentMentionPos = {
    start: cursorPos,
    end: cursorPos
  };

  document.body.removeChild(mirror);
}

// 选择用户
function selectMention(username) {
  if (!currentMentionPos) return;

  const start = currentMentionPos.start - 1; // 包含@符号
  const end = currentMentionPos.end;

  // 替换内容
  annotate_content.value =
    annotate_content.value.slice(0, start) +
    `@${username} ` +  // 自动添加空格
    annotate_content.value.slice(end);

  // 设置光标位置
  const newPos = start + username.length + 2; // @符号+空格
  annotate_content.focus();
  annotate_content.setSelectionRange(newPos, newPos);

  hideMentionList();
}

function hideMentionList() {
  mentionList.style.display = 'none';
  currentMentionPos = null;
}

function handleArrowKeys(key) {
  const items = mentionList.querySelectorAll('.mention-item');
  let active = document.querySelector('.mention-item.active');

  if (!active) {
    items[0]?.classList.add('active');
    return;
  }

  const index = Array.from(items).indexOf(active);
  if (key === 'ArrowDown') {
    items[(index + 1) % items.length]?.classList.add('active');
  } else {
    items[(index - 1 + items.length) % items.length]?.classList.add('active');
  }
  active.classList.remove('active');
}

// 处理方式
function toggleFields() {
  const showFields = intypeSelect.value === '1';
  contentGroup.classList.toggle('hidden', !showFields);
  noteGroup.classList.toggle('hidden', !showFields);
  if (showFields) {
    form_row_fenfa.style.display = 'none'
  } else {
    form_row_fenfa.style.display = 'grid'
  }
  // 设置字段必填状态
  document.getElementById('annotate-content').required = showFields;
  document.getElementById('annotate-note').required = showFields;
}
//添加批注表单
document.getElementById('annotate-Form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const type = intypeSelect.value === '1';
    const data = {
      annotate_type: currentType,
      processing_mode: getValidatedSelectValue('#annotate-intype'),
      content: type ? document.getElementById('annotate-content').value.trim() : null,
      annotate_note: type ? document.getElementById('annotate-note').value.trim() : null,
      annotate_at: document.getElementById('annotate-date').value,
      authorId: getValidatedSelectValue('#annotate-author'),
      distribution_scope: type ? null : `${getValidatedSelectValue('#primary-unit')}-${getValidatedSelectValue('#secondary-unit')}`,
      distribution_at: type ? null : document.getElementById('fenfa-date').value,
      uuid: currentDocId
    };

    // 调用Electron API

    const result = await window.electronAPI.db.addAnnotation(data);

    if (result.changes > 0) {
      hideAnnotate();
      document.getElementById('annotate-Form').reset();
    }
  } catch (error) {
    console.error('添加批注失败:', error);
    alert('添加批注失败');
  }
});


/**
 * 填充选项 名字
 */
async function loadSelectOptions() {
  try {
    const result = await window.electronAPI.db.getAuthors()

    // 填充呈阅领导
    populateSelect('#review_leader', result)
    // 填充密级

    //编辑弹窗填充
    // 填充呈阅领导
    populateSelect('#pop-review_leader', result)

    //添加备注名称
    populateSelect('#annotate-author', result)

    //缓存user搜索数据

    users = result
  } catch (error) {
    console.error('配置加载失败:', error)
  }
}
//填充选项 单位
async function loadSelectAnnotate() {
  try {
    const response = await window.electronAPI.getCascaderData();
    const config = JSON.parse(response);


    // 2. 优化单位联动逻辑
    const primarySelect = document.getElementById('primary-unit');
    const secondarySelect = document.getElementById('secondary-unit');

    // 初始化单位数据
    const initUnits = () => {
      primarySelect.innerHTML = '<option value="">请选择</option>';
      secondarySelect.innerHTML = '<option value="">请选择</option>';

      // 容错处理无效数据结构
      if (config.unit && typeof config.unit === 'object') {
        Object.keys(config.unit).forEach(primary => {
          const option = new Option(primary, primary);
          primarySelect.add(option);
        });

        // 自动初始化首选项
        if (Object.keys(config.unit).length > 0) {
          const firstPrimary = Object.keys(config.unit)[0];
          primarySelect.value = firstPrimary;
          updateSecondaryOptions(firstPrimary);
        }
      }
    };

    // 更新二级单位
    const updateSecondaryOptions = (primaryKey) => {
      secondarySelect.innerHTML = '<option value="">请选择</option>';

      if (config.unit[primaryKey]?.length) {
        config.unit[primaryKey].forEach(unit => {
          const option = new Option(unit, unit);
          secondarySelect.add(option);
        });
      }
    };

    // 事件监听优化
    primarySelect.addEventListener('change', (e) => {
      updateSecondaryOptions(e.target.value);
    });

    initUnits();
  } catch (error) {
    console.error('配置加载失败:', error)
  }
}
function populateSelect(selector, options) {
  const select = document.querySelector(selector)
  select.innerHTML = options.map(opt =>
    `<option value="${opt.authorId}">${opt.name}</option>`
  ).join('')
}


/**
 * 分发单位弹窗
 */
let configData = {
  options: {},
  annotate: {}
};
function showConfigModal() {
  loadAllConfig();
  document.getElementById('config-modal').style.display = 'block';
}
function hideConfigModal() {
  document.getElementById('config-modal').style.display = 'none';
}

async function loadAllConfig() {
  try {
    // 加载批注配置
    const annotateRes = await window.electronAPI.db.getUnitWithSon();

    //renderConfigEditors();
  } catch (error) {
    console.error('配置加载失败:', error);
  }
}
function renderConfigEditors() {
  // 渲染单位层级
  renderUnitEditor('unit-editor',
    configData.annotate.unit || {},
    (data) => configData.annotate.unit = data
  );
}
// 单位层级编辑器
function renderUnitEditor(containerId, unitData, updateFn) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const renderNode = (parent, data, path = []) => {
    Object.entries(data).forEach(([key, value]) => {
      const node = document.createElement('div');
      node.className = 'unit-node';

      node.innerHTML = `
        <div class="node-header">
          <input type="text" value="${key}" class="unit-input">
          <div class="node-actions">
            <button class="add-child-btn">+ 子单位</button>
            <button class="delete-btn">×</button>
          </div>
        </div>
        <div class="children-container"></div>
      `;

      const childrenContainer = node.querySelector('.children-container');
      if (Array.isArray(value)) {
        value.forEach(child => {
          const childNode = document.createElement('div');
          childNode.className = 'unit-node';
          childNode.innerHTML = `
            <div class="node-header">
              <input type="text" value="${child}" class="unit-input">
              <button class="delete-btn">×</button>
            </div>
          `;
          childrenContainer.appendChild(childNode);
        });
      }

      parent.appendChild(node);
    });
  };

  renderNode(container, unitData);

}
async function saveAllConfig() {
  try {
    // 保存表单选项配置
    await window.electronAPI.saveConfig({
      type: 'form-options',
      data: configData.options
    });

    // 保存批注配置
    await window.electronAPI.saveConfig({
      type: 'form-annotate',
      data: configData.annotate
    });

    // 重新加载下拉选项
    loadSelectOptions();
    loadSelectAnnotate();
    hideConfigModal();
    alert('配置保存成功！');
  } catch (error) {
    console.error('保存失败:', error);
    alert('保存失败，请检查控制台');
  }
}


/**
 * 
 * 展示列表全部信息,type = 1,普通文件
 */
async function showDocDetail(docId, type = 1) {
  try {
    // 获取主文档信息
    let doc
    let annotations

    doc = await window.electronAPI.db.getDocumentById(docId);
    annotations = await window.electronAPI.db.getAnnotations({
      uuid: docId,
      annotate_type: type
    });

    // 构建基本信息HTML
    const docInfoHTML = `
      <div class="doc-header">
        <h2>${doc.title || '无标题'}</h2>
        <div class="doc-meta">
          <span class="doc-date">创建时间：${new Date(doc.created_at).toLocaleString()}</span>
        </div>
      </div>
      
      <div class="doc-details">
        <div class="detail-item">
          <label>来文单位：</label>
          <span>${doc.sender_unit || '未填写'}</span>
        </div>
        <div class="detail-item">
          <label>来文编号：</label>
          <span>${doc.sender_number || '未填写'}</span>
        </div>
        <div class="detail-item">
          <label>原文号：</label>
          <span>${doc.original_number || '未填写'}</span>
        </div>
        <div class="detail-item">
          <label>制文单位：</label>
          <span>${doc.drafting_unit || '未填写'}</span>
        </div>
      </div>
    `;

    // 构建批注HTML
    const annotationsHTML = annotations.length > 0 ?
      annotations.map(anno => `
        <div class="annotation ${anno.processing_mode === 3 ? 'circle-read' : ''}">
          <div class="annotation-header">
            <span class="author">${anno.author || '匿名'}</span>
            <span class="date">${new Date(anno.created_at).toLocaleDateString()}</span>
          </div>
          <div class="annotation-content">
            ${anno.processing_mode === 1 ?
          `<p>内容：${anno.content || '无'}</p>` :
          anno.processing_mode === 2 ?
            `<p>内容不录入</p>` :
            anno.processing_mode === 3 ?
              `<p>仅圈阅</p>` : ''
        }
          </div>
          ${anno.distribution_scope || anno.distribution_at ? `
          <div class="distribution-info">
            ${anno.distribution_scope ? `<div>分发范围：${anno.distribution_scope}</div>` : ''}
            ${anno.distribution_at ? `<div>分发日期：${new Date(anno.distribution_at).toLocaleDateString()}</div>` : ''}
          </div>` : ''}
        </div>  
      `).join('') :
      '<div class="no-annotations">暂无批注信息</div>';

    // 更新DOM
    document.getElementById('doc_info').innerHTML = docInfoHTML;
    document.getElementById('annotate-info').innerHTML = `
      <h3>批注记录（${annotations.length}条）</h3>
      ${annotationsHTML}
    `;

    // 显示弹窗
    document.getElementById('show-allinfo').style.display = 'flex';
  } catch (error) {
    console.error('显示详情失败:', error);
    alert('无法加载文档详情，请检查控制台');
  }
}

/**
 * 
 * 关闭列表全部信息
 */
document.querySelector('#show-allinfo .annotate-bg').addEventListener('click', (e) => {
  if (e.target.closest('.annotate-content')) return;
  hideAllInfo();
});

function hideAllInfo() {
  document.getElementById('show-allinfo').style.display = 'none';
}

/**
 * 姓名管理模块
 */
document.getElementById('add-name-btn').addEventListener('click', async (e) => {
  const name = document.getElementById('name').value.trim();
  const alias = document.getElementById('alias').value.trim();

  if (!name || !alias) {
    alert('姓名和别名不能为空');
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
      const newAuthor = await window.electronAPI.db.createAuthor({ name });
      authorId = newAuthor;
    }

    // 添加别名（自动处理唯一性）
    await window.electronAPI.db.addAuthorAlias({
      author_id: authorId,
      alias: alias
    });

    // 清空输入并刷新列表
    document.getElementById('name').value = '';
    document.getElementById('alias').value = '';
    loadSelectOptions();
    loadAuthorsWithAliases();
  } catch (error) {
    console.error('操作失败:', error);
    alert(`操作失败: ${error.message}`);
  }

});


let currentOpenItem = null; // 跟踪当前展开项
function initCollapsible() {
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const isSameItem = header === currentOpenItem;

      // 关闭所有其他项
      document.querySelectorAll('.collapsible-header').forEach(h => {
        if (h !== header) {
          h.classList.remove('active');
          h.nextElementSibling.style.maxHeight = null;
        }
      });

      // 切换当前项
      if (!isSameItem) {
        header.classList.add('active');
        content.style.maxHeight = `${content.scrollHeight}px`;
        currentOpenItem = header;
      } else {
        header.classList.remove('active');
        content.style.maxHeight = null;
        currentOpenItem = null;
      }

      // 更新箭头图标
      const icon = header.querySelector('.toggle-icon');
      icon.textContent = header.classList.contains('active') ? '▼' : '▶';
    });
  });
}

// 加载姓名树形结构
async function loadAuthorsWithAliases() {
  const container = document.getElementById('name-tree');
  try {
    const authors = await window.electronAPI.db.getAuthorsWithAliases() || [];
    container.replaceChildren();

    authors.forEach(author => {
      let aliases;
      if (typeof author.aliases === 'string') {
        try {
          aliases = JSON.parse(author.aliases);
        } catch (e) {
          aliases = [];
        }
      } else if (Array.isArray(author.aliases)) {
        aliases = author.aliases; // 直接使用已解析的数组
      } else {
        aliases = [];
      }

      // 克隆模板
      const itemTemplate = document.getElementById('collapsible-item-template');
      const clone = itemTemplate.content.cloneNode(true);
      const item = clone.querySelector('.collapsible-item');

      // 填充作者信息
      const authorName = item.querySelector('.author-name');
      authorName.textContent = author.name || '无名氏';
      item.querySelector('.delete-author').dataset.id = author.authorId;

      // 添加箭头图标（确保初始化显示）
      const toggleIcon = item.querySelector('.toggle-icon');
      toggleIcon.textContent = '▶';

      // 处理别名
      const aliasContainer = item.querySelector('.collapsible-content');
      aliases.forEach(alias => {
        const aliasTemplate = document.getElementById('alias-item-template');
        const aliasClone = aliasTemplate.content.cloneNode(true);
        const aliasItem = aliasClone.querySelector('.alias-item');

        aliasItem.querySelector('.alias-name').textContent = alias.alias;
        aliasItem.querySelector('.delete-alias').dataset.id = alias.id;

        aliasContainer.appendChild(aliasItem);
      });

      container.appendChild(clone);
    });

    // 初始化折叠功能
    initCollapsible();

  } catch (error) {
    console.error('加载失败:', error);
    showError(container);
  }
}



// 在容器上统一监听点击事件
document.getElementById('name-tree').addEventListener('click', async e => {
  // 删除作者
  if (e.target.matches('.delete-author')) {
    if (!confirm('确定删除作者及其所有别名？')) return;
    try {
      await window.electronAPI.db.deleteAuthor(e.target.dataset.id);
      loadAuthorsWithAliases();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请检查控制台');
    }
  }

  // 删除别名
  if (e.target.matches('.delete-alias')) {
    if (!confirm('确定删除该别名？')) return;
    try {
      await window.electronAPI.db.deleteAlias(e.target.dataset.id);
      loadAuthorsWithAliases();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请检查控制台');
    }
  }
});




/**
 * 单位管理模块
 */
document.getElementById('add-unit-btn').addEventListener('click', async (e) => {
  const name = document.getElementById('unit').value.trim();
  const unitSon = document.getElementById('unit-son').value.trim();

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

    // 添加别名（自动处理唯一性）
    await window.electronAPI.db.addUnitSon({
      unit_id: unitId,
      unit_son_name: unitSon
    });

    // 清空输入并刷新列表
    document.getElementById('unit').value = '';
    document.getElementById('unit-son').value = '';
    // loadSelectAnnotate();
    loadUnitWithSon();
  } catch (error) {
    console.error('操作失败:', error);
    alert(`操作失败: ${error.message}`);
  }

});



let currentOpenItemUnit = null; // 跟踪当前展开项
function initCollapsibleUnit() {
  document.querySelectorAll('.collapsible-unit-header').forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const isSameItem = header === currentOpenItem;

      // 关闭所有其他项
      document.querySelectorAll('.collapsible-unit-header').forEach(h => {
        if (h !== header) {
          h.classList.remove('active');
          h.nextElementSibling.style.maxHeight = null;
        }
      });

      // 切换当前项
      if (!isSameItem) {
        header.classList.add('active');
        content.style.maxHeight = `${content.scrollHeight}px`;
        currentOpenItem = header;
      } else {
        header.classList.remove('active');
        content.style.maxHeight = null;
        currentOpenItem = null;
      }

      // 更新箭头图标
      const icon = header.querySelector('.unit-toggle-icon');
      icon.textContent = header.classList.contains('active') ? '▼' : '▶';
    });
  });
}

// // 加载姓名树形结构
// async function loadUnitWithSon() {
//   const container = document.getElementById('unit-tree');
//   try {
//     const units = await window.electronAPI.db.getUnitWithSon() || [];
//     container.replaceChildren();

//     units.forEach(unit => {
//       let unitsSon;
//       if (typeof unit.unitSons === 'string') {
//         try {
//           unitsSon = JSON.parse(unit.unitSons);
//         } catch (e) {
//           unitsSon = [];
//         }
//       } else if (Array.isArray(unit.unitSons)) {
//         unitsSon = unit.unitSons; // 直接使用已解析的数组
//       } else {
//         unitsSon = [];
//       }

//       // 克隆模板
//       const itemTemplate = document.getElementById('collapsible-item-unit');
//       const clone = itemTemplate.content.cloneNode(true);
//       const item = clone.querySelector('.collapsible-unit');

//       // 填充作者信息
//       const unitName = item.querySelector('.unit-name');
//       unitName.textContent = unit.name || '';
//       item.querySelector('.delete-unit').dataset.id = unit.unitId;

//       // 添加箭头图标（确保初始化显示）
//       const unittoggleIcon = item.querySelector('.unit-toggle-icon');
//       unittoggleIcon.textContent = '▶';

//       // 处理别名
//       const unitsonContainer = item.querySelector('.collapsible-unit-content');
//       unitsSon.forEach(unitson => {
//         const unitsonTemplate = document.getElementById('unitson-item-template');
//         const unitsonClone = unitsonTemplate.content.cloneNode(true);
//         const unitsonItem = unitsonClone.querySelector('.unitson-item');

//         unitsonItem.querySelector('.unitson-name').textContent = unitson.unit_son_name;
//         unitsonItem.querySelector('.delete-unitson').dataset.id = unitson.id;

//         unitsonContainer.appendChild(unitsonItem);
//       });

//       container.appendChild(clone);
//     });

//     // 初始化折叠功能
//     initCollapsibleUnit();

//   } catch (error) {
//     console.error('加载失败:', error);
//     showError(container);
//   }
// }

function showError(container) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = '加载失败，请刷新页面';
  container.appendChild(errorDiv);
}

// 在容器上统一监听点击事件
document.getElementById('unit-tree').addEventListener('click', async e => {
  // 删除作者
  if (e.target.matches('.delete-unit')) {
    if (!confirm('确定删除单位及其所有子单位？')) return;
    try {
      await window.electronAPI.db.deleteUnit(e.target.dataset.id);
      loadUnitWithSon();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请检查控制台');
    }
  }

  // 删除别名
  if (e.target.matches('.delete-unitson')) {
    if (!confirm('确定删除该子单位？')) return;
    try {
      await window.electronAPI.db.deleteUnitSon(e.target.dataset.id);
      loadUnitWithSon();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请检查控制台');
    }
  }
});


