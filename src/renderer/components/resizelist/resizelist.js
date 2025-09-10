if (!customElements.get('resizable-table')) {
    class ResizableTable extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });

            // 组件状态
            this.isResizing = false;
            this.currentHeader = null;
            this.startX = 0;
            this.startWidth = 0;
            this.sortColumn = null;
            this.sortDirection = null;
            this.tableData = [];
            this.headers = [];
            this.allKeys = [];
            this.visibleKeys = [];
            this.headersMap = {};
            this.originalData = [];
            this.specialKeys = [];
            this.columnWidths = {}; // 使用对象存储列宽度，键为列名
            this.contextMenu = null;
            this.tableContainer = null;
            this.headerTable = null;
            this.headersRow = null;
            this.bodyTable = null;
            this.colgroup = null; // 用于存储列组元素
            this.scrollbarWidth = 0; // 存储滚动条宽度

            // 渲染组件
            this.render();
        }

        connectedCallback() {
            this.dispatchEvent(new CustomEvent('component-ready', {
                bubbles: true,
                composed: true
            }));

            // 添加全局点击监听器关闭菜单
            document.addEventListener('click', this.closeContextMenu.bind(this));

            // 获取表格元素引用
            this.headerTable = this.shadowRoot.getElementById('table-headers-table');
            this.headersRow = this.shadowRoot.getElementById('table-headers');
            this.bodyTable = this.shadowRoot.getElementById('table-body-table');
            this.colgroup = this.bodyTable.querySelector('colgroup');
            this.bodyContainer = this.shadowRoot.querySelector('.table-body-container');
            this.headerContainer = this.shadowRoot.querySelector('.table-header-container');
            this.tableContainer = this.shadowRoot.querySelector('.table-container');

            // 添加滚动同步监听
            this.bodyContainer.addEventListener('scroll', this.syncHeaderScroll.bind(this));

            // 计算滚动条宽度
            this.calculateScrollbarWidth();
        }

        calculateScrollbarWidth() {
            // 创建测试元素计算滚动条宽度
            const scrollDiv = document.createElement('div');
            scrollDiv.style.width = '100px';
            scrollDiv.style.height = '100px';
            scrollDiv.style.overflow = 'scroll';
            scrollDiv.style.position = 'absolute';
            scrollDiv.style.top = '-9999px';
            document.body.appendChild(scrollDiv);

            this.scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
            document.body.removeChild(scrollDiv);

            // 设置CSS变量
            this.style.setProperty('--scrollbar-width', `${this.scrollbarWidth}px`);
        }

        syncHeaderScroll() {
            const bodyScrollLeft = this.bodyContainer.scrollLeft;
            const bodyMaxScroll = this.bodyTable.scrollWidth - this.bodyContainer.clientWidth;
            const headerMaxScroll = this.headerTable.scrollWidth - this.headerContainer.clientWidth;

            // 边界修正：表体滚动到底时，表头同步到修正后的位置
            if (bodyScrollLeft >= bodyMaxScroll - 1) { // 减去1以避免小数点精度问题
                this.headerContainer.scrollLeft = headerMaxScroll;
            } else {
                this.headerContainer.scrollLeft = bodyScrollLeft;
            }

            // 使用requestAnimationFrame优化性能
            requestAnimationFrame(() => {
                // 确保表头容器滚动位置正确
                if (Math.abs(this.headerContainer.scrollLeft - this.bodyContainer.scrollLeft) > 1) {
                    this.headerContainer.scrollLeft = this.bodyContainer.scrollLeft;
                }
            });
        }

        setHeaderMap(map) {
            if (map && typeof map === 'object') {
                this.headerMap = map;
                this.renderHeaders();
            }
        }

        setData(data) {
            if (!data) {
                data = [];
            }

            // 确保是数组
            if (!Array.isArray(data)) {
                console.error('setData expects an array');
                return;
            }

            this.originalData = data;

            // 处理空数组情况
            if (data.length === 0) {
                this.allKeys = [];
                this.visibleKeys = [];
                this.tableData = [];
                this.headers = [];
                this.renderHeaders();
                this.renderBody();
                return;
            }

            // 正常数据处理
            if (typeof data[0] === 'object') {
                this.allKeys = Object.keys(data[0]);
                this.visibleKeys = ['id', 'title', 'sender_number', 'sender_date', 'input_user'];
            }

            this.columnWidths['id'] = this.columnWidths['id'] || 60;

            this.tableData = this.originalData.map(item => {
                return this.visibleKeys.map(key => this.getCellValue(item, key));
            });

            this.headers = this.visibleKeys.map(key => ({
                key: key,
                text: key,
                type: this.detectType(this.originalData[0][key])
            }));

            this.applyHeaderMapping();
            this.renderHeaders();
            this.renderBody();
        }

        getCellValue(item, key) {
            const value = item[key];
            if (Array.isArray(value)) {
                return value.map(v => (typeof v === 'object' ? v.keyword ?? '' : v)).join(', ');
            }
            if (value && typeof value === 'object') {
                return value.keyword ?? '';
            }
            return value ?? '';
        }

        applyHeaderMapping() {
            this.headers = this.headers.map(header => {
                if (this.headerMap[header.key]) {
                    return {
                        ...header,
                        text: this.headerMap[header.key]
                    };
                }
                return header;
            });
        }

        detectType(value) {
            if (typeof value === 'number') return 'number';
            if (!isNaN(Date.parse(value))) return 'date';
            return 'string';
        }

        addRow(rowData) {
            this.tableData.push(rowData);
            this.renderBody();
        }

        render() {
            this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    overflow: hidden;
                }
                
                .table-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    width: 100%;
                }
                
                .table-header-container {
                    overflow: auto hidden; /* 水平滚动 */
                    position: relative;
                    height: auto;
                    scrollbar-width: none; /* 隐藏滚动条 */
                    width: calc(100% - 6px);
                    box-sizing: border-box;
                }
                
                .table-header-container::-webkit-scrollbar {
                    display: none; /* 隐藏Webkit滚动条 */
                }
                
                .table-body-container {
                    width: 100%;
                    flex: 1;
                    overflow: auto;
                    overflow-y: scroll;
                    scrollbar-width: auto;
                    scrollbar-gutter: stable;
                    scroll-behavior: smooth; /* 平滑滚动 */
                }

                table {
                    border-spacing: 0;
                    table-layout: fixed;
                    width: calc(100% - 6px); /* 确保表格宽度填满容器 */
                }

                th {
                    background: #fafafa;
                    position: relative;
                    cursor: pointer;
                    font-weight: 500;
                    color: rgba(29, 33, 41, 1);
                    font-size: 14px;
                    user-select: none;
                    transition: background 0.3s;
                    box-sizing: border-box;
                    text-align: left;
                    padding: 10px 12px;
                    border-bottom: 1px solid #e0e0e0;
                    min-width: 60px;
                    max-width: 800px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                th:hover {
                    background-color: #f5f5f5;
                }

                #table-headers-table,
                #table-body-table {
                    border-collapse: collapse;
                    table-layout: fixed; /* 保持固定布局 */
                }

                #table-body-table tr {
                    transition: background-color 0.2s;
                    border-bottom: 1px solid #f0f0f0;
                }

                #table-body-table tr:hover {
                    background-color: #f5faff;
                }

                #table-body-table tr.selected {
                    background-color: #e6f7ff;
                }
                #table-body-table tr.important {
                    background-color: #ffeaea;
                }

                #table-body-table td {
                    box-sizing: border-box;
                    padding: 6px 8px;
                    height: 47px;
                    min-width: 60px;
                    max-width: 800px;
                    overflow: hidden;
                    word-wrap: break-word;
                    white-space: normal;
                    border: none;
                }

                #table-headers-table {
                    border-collapse: collapse;
                }

                thead {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }

                .sort-icon {
                    display: inline-block;
                    width: 8px;
                    height: 12px;
                    margin-left: 6px;
                    position: relative;
                }

                .sort-icon::before,
                .sort-icon::after {
                    content: '';
                    position: absolute;
                    left: 0;
                    width: 0;
                    height: 0;
                    border-left: 4px solid transparent;
                    border-right: 4px solid transparent;
                }

                .sort-icon::before {
                    top: 0;
                    border-bottom: 6px solid #ccc;
                }

                .sort-icon::after {
                    bottom: 0;
                    border-top: 6px solid #ccc;
                }

                th.asc .sort-icon::before {
                    border-bottom-color: #1890ff;
                }

                th.desc .sort-icon::after {
                    border-top-color: #1890ff;
                }
                
                .resizer {
                    position: absolute;
                    top: 0;
                    right: 0;
                    width: 4px;
                    height: 100%;
                    background: transparent;
                    cursor: col-resize;
                    z-index: 10;
                }
                
                .resizer:hover, .resizer.active {
                    background: #2196F3;
                }

                .drag-indicator {
                    position: fixed;
                    top: 0;
                    left: 0;
                    height: 100%;
                    width: 1px;
                    background: #bbbbbb;
                    display: none;
                    z-index: 100;
                    pointer-events: none;
                }
                
                /* 右键菜单样式 */
                .column-context-menu {
                    position: fixed;
                    background: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 1000;
                    display: none;
                    min-width: 180px;
                }
                
                .menu-header {
                    padding: 8px 12px;
                    font-weight: bold;
                    border-bottom: 1px solid #eee;
                    background-color: #f5f5f5;
                }
                
                .menu-list {
                    padding: 5px 0;
                }
                
                .menu-item {
                    padding: 5px 12px;
                    display: flex;
                    align-items: center;
                }
                
                .menu-item label {
                    margin-left: 8px;
                    cursor: pointer;
                    user-select: none;
                }
                
                .menu-footer {
                    padding: 8px 12px;
                    font-size: 0.8em;
                    color: #999;
                    border-top: 1px solid #eee;
                    background-color: #f5f5f5;
                }
                
                /* 自定义滚动条样式 */
                .table-body-container::-webkit-scrollbar {
                    width: 6px;
                    height: 10px;
                }
                
                .table-body-container::-webkit-scrollbar-track {
                    background-color:transparent;
                }
                
                .table-body-container::-webkit-scrollbar-thumb {
                    background-color: transparent;
                    border-radius: 5px;
                }

                .table-body-container:hover::-webkit-scrollbar-thumb {
                    background-color: rgba(194, 194, 194, 0.4);
                }
                
                @media (max-width: 768px) {
                    th, td {
                        padding: 14px 18px;
                    }
                }
            </style>
            
            <div class="table-container">
                <div class="table-header-container">
                    <table id="table-headers-table">
                        <colgroup id="header-colgroup"></colgroup>
                        <thead>
                            <tr id="table-headers"></tr>
                        </thead>
                    </table>
                </div>
                <div class="table-body-container">
                    <table id="table-body-table">
                        <colgroup id="body-colgroup"></colgroup>
                        <tbody id="table-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="drag-indicator" id="drag-indicator"></div>
            <!-- 右键菜单 -->
            <div class="column-context-menu" id="context-menu">
                <div class="menu-header">显示/隐藏列</div>
                <div class="menu-list" id="menu-list"></div>
                <div class="menu-footer">至少需要保留4列可见</div>
            </div>
        `;

            this.contextMenu = this.shadowRoot.getElementById('context-menu');
        }

        renderHeaders() {
            const headersRow = this.shadowRoot.getElementById('table-headers');
            headersRow.innerHTML = '';

            const headerColgroup = this.shadowRoot.getElementById('header-colgroup');
            headerColgroup.innerHTML = '';

            // 计算总宽度
            let totalWidth = 0;

            this.headers.forEach(header => {
                // 创建列元素
                const col = document.createElement('col');
                const width = this.columnWidths[header.key] || 150;
                col.style.width = `${width}px`;
                if (header.key === 'id') {
                    col.style.minWidth = `${width}px`;
                    col.style.maxWidth = `${width}px`;
                }
                headerColgroup.appendChild(col);

                // 创建表头单元格
                const th = document.createElement('th');
                th.textContent = header.text;
                th.setAttribute('data-type', header.type);
                th.setAttribute('data-key', header.key);

                // 应用列宽
                th.style.width = `${width}px`;
                if (header.key === 'id') {
                    th.style.minWidth = `${width}px`;
                    th.style.maxWidth = `${width}px`;
                }
                totalWidth += width;

                const sortIcon = document.createElement('span');
                sortIcon.classList.add('sort-icon');
                th.appendChild(sortIcon);

                if (header.key !== 'id') {
                    const resizer = document.createElement('div');
                    resizer.classList.add('resizer');
                    th.appendChild(resizer);
                }

                th.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    this.showContextMenu(e);
                });

                headersRow.appendChild(th);
            });

            // 设置表头表格的宽度（确保宽度足够显示所有列）
            this.headerTable.style.width = `${totalWidth}px`;

            this.initResizableColumns();
            this.initSortableTable();
            this.headerTable.style.minWidth = '100%';
        }

        renderBody() {
            const tableBody = this.shadowRoot.getElementById('table-body');
            tableBody.innerHTML = '';

            const bodyColgroup = this.shadowRoot.getElementById('body-colgroup');
            bodyColgroup.innerHTML = '';

            // 计算总宽度
            let totalWidth = 0;
            this.visibleKeys.forEach(key => {
                const col = document.createElement('col');
                const width = this.columnWidths[key] || 150;
                col.style.width = `${width}px`;
                if (key === 'id') {
                    col.style.minWidth = `${width}px`;
                    col.style.maxWidth = `${width}px`;
                }
                bodyColgroup.appendChild(col);
                totalWidth += width;
            });

            // 设置表体表格的宽度（确保宽度足够显示所有列）
            this.bodyTable.style.width = `${totalWidth}px`;

            this.tableData.forEach((rowData, rowIndex) => {
                const row = document.createElement('tr');
                row.dataset.index = rowIndex;
                this.visibleKeys.forEach((key, index) => {
                    const cell = document.createElement('td');
                    const value = rowData[index];
                    cell.textContent = value;
                    if (key === 'status') {
                        if (value === '待分发') {
                            cell.style.color = 'red';
                        } else if (value === '流转中') {
                            cell.style.color = '#faad14';
                        } else if (value === '已办结') {
                            cell.style.color = '#52c41a';
                        }
                    }
                    row.appendChild(cell);
                });
                if (this.originalData[rowIndex].is_important) {
                    row.classList.add('important');
                }
                // 单击仅高亮行
                row.addEventListener('click', (e) => {
                    if (e.target.closest('.action-btn')) return;
                    this.highlightRow(rowIndex);
                });

                // 双击触发侧边栏
                row.addEventListener('dblclick', (e) => {
                    if (e.target.closest('.action-btn')) return;

                    const originalData = this.originalData[rowIndex];
                    this.highlightRow(rowIndex);
                    this.dispatchEvent(new CustomEvent('row-click', {
                        detail: {
                            data: originalData,
                            index: rowIndex
                        }
                    }));
                });

                tableBody.appendChild(row);
            });

            // 滚动同步（确保表头位置正确）
            this.syncHeaderScroll();
            this.bodyTable.style.minWidth = '100%';
        }

        highlightRow(index) {
            const rows = this.shadowRoot.querySelectorAll('#table-body tr');
            rows.forEach((r, i) => {
                r.classList.toggle('selected', i === index);
            });
            this.selectedIndex = index;
        }

        clearSelection() {
            const rows = this.shadowRoot.querySelectorAll('#table-body tr.selected');
            rows.forEach(r => r.classList.remove('selected'));
            this.selectedIndex = null;
        }

        // 显示右键菜单
        showContextMenu(e) {
            if (!this.contextMenu) return;

            const menuList = this.shadowRoot.getElementById('menu-list');
            menuList.innerHTML = '';

            this.allKeys.forEach(key => {
                if (key === 'uuid' || key === 'created_at' || key === 'docType' || key === 'doc_type' || key === 'review_leader' || key === 'is_important') {
                    return
                }
                const isVisible = this.visibleKeys.includes(key);
                const menuItem = document.createElement('div');
                menuItem.classList.add('menu-item');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = `col-${key}`;
                checkbox.checked = isVisible;

                if (this.visibleKeys.length === 4 && isVisible) {
                    checkbox.disabled = true;
                }

                checkbox.addEventListener('change', () => {
                    this.toggleColumnVisibility(key, checkbox.checked);
                });

                const label = document.createElement('label');
                label.textContent = this.headerMap[key] || key;
                label.htmlFor = `col-${key}`;

                menuItem.appendChild(checkbox);
                menuItem.appendChild(label);
                menuList.appendChild(menuItem);
            });

            this.contextMenu.style.display = 'block';
            this.contextMenu.style.left = `${e.clientX}px`;
            this.contextMenu.style.top = `${e.clientY}px`;
        }

        // 关闭右键菜单
        closeContextMenu(e) {
            if (!this.contextMenu) return;

            const isClickInside = this.shadowRoot.contains(e.target);
            if (!isClickInside) {
                this.contextMenu.style.display = 'none';
            }
        }

        // 切换列可见性
        toggleColumnVisibility(key, visible) {
            const visibleCount = this.visibleKeys.length;

            if (visible) {
                if (this.visibleKeys.includes(key)) return;

                const allKeysIndex = this.allKeys.indexOf(key);
                if (allKeysIndex === -1) return;

                let insertIndex = 0;
                for (let i = 0; i < this.visibleKeys.length; i++) {
                    const currentKey = this.visibleKeys[i];
                    const currentIndex = this.allKeys.indexOf(currentKey);
                    if (currentIndex > allKeysIndex) {
                        insertIndex = i;
                        break;
                    }
                    insertIndex = i + 1;
                }

                this.visibleKeys.splice(insertIndex, 0, key);
            } else {
                if (visibleCount <= 4) return;

                const index = this.visibleKeys.indexOf(key);
                if (index !== -1) {
                    this.visibleKeys.splice(index, 1);
                }
            }

            this.tableData = this.originalData.map(item => {
                return this.visibleKeys.map(k => this.getCellValue(item, k));
            });

            this.headers = this.visibleKeys.map(k => ({
                key: k,
                text: this.headerMap[k] || k,
                type: this.detectType(this.originalData[0][k])
            }));

            this.renderHeaders();
            this.renderBody();
        }

        initResizableColumns() {
            const headers = this.shadowRoot.querySelectorAll('th');
            const indicator = this.shadowRoot.getElementById('drag-indicator');

            headers.forEach(header => {
                const key = header.getAttribute('data-key');
                const resizer = header.querySelector('.resizer');

                // Skip non-resizable columns like the fixed sequence column
                if (!resizer) return;

                resizer.addEventListener('mousedown', (e) => {
                    this.isResizing = true;
                    this.currentHeader = header;
                    const rect = this.headerContainer.getBoundingClientRect();
                    this.startX = e.clientX - rect.left + this.headerContainer.scrollLeft;
                    this.startWidth = header.getBoundingClientRect().width;
                    resizer.classList.add('active');

                    // 保存当前宽度
                    this.columnWidths[key] = this.startWidth;

                    indicator.style.display = 'block';
                    indicator.style.left = e.clientX + 'px';

                    document.addEventListener('mousemove', this.doDrag);
                    document.addEventListener('mouseup', this.stopDrag);
                    document.addEventListener('mouseleave', this.stopDrag);
                });
            });
        }

        doDrag = (e) => {
            if (!this.isResizing) return;

            const MIN_WIDTH = 120;
            const MAX_WIDTH = 800;
            const rect = this.headerContainer.getBoundingClientRect();
            let currentX = e.clientX - rect.left + this.headerContainer.scrollLeft;
            let newWidth = this.startWidth + (currentX - this.startX);
            newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));

            // 更新当前列的宽度
            const key = this.currentHeader.getAttribute('data-key');
            this.currentHeader.style.width = `${newWidth}px`;
            this.columnWidths[key] = newWidth;

            // 更新表头列组
            const headerColgroup = this.shadowRoot.getElementById('header-colgroup');
            const headerCols = headerColgroup.querySelectorAll('col');
            const headerIndex = Array.from(this.currentHeader.parentElement.children).indexOf(this.currentHeader);
            if (headerCols[headerIndex]) {
                headerCols[headerIndex].style.width = `${newWidth}px`;
            }

            // 更新表体列组
            const bodyColgroup = this.shadowRoot.getElementById('body-colgroup');
            const bodyCols = bodyColgroup.querySelectorAll('col');
            if (bodyCols[headerIndex]) {
                bodyCols[headerIndex].style.width = `${newWidth}px`;
            }

            const indicator = this.shadowRoot.getElementById('drag-indicator');
            indicator.style.left = e.clientX + 'px';

            // 更新表格宽度
            this.updateTableWidths();
        };

        stopDrag = () => {
            if (!this.isResizing) return;

            this.isResizing = false;
            this.shadowRoot.querySelectorAll('.resizer').forEach(r => r.classList.remove('active'));
            this.shadowRoot.getElementById('drag-indicator').style.display = 'none';

            document.removeEventListener('mousemove', this.doDrag);
            document.removeEventListener('mouseup', this.stopDrag);
            document.removeEventListener('mouseleave', this.stopDrag);

            // 重新计算并设置表格宽度
            this.updateTableWidths();

            // 同步滚动位置
            this.syncHeaderScroll();
        };

        // 更新表格宽度
        updateTableWidths() {
            // 计算表头表格宽度
            let headerWidth = 0;
            const headerCols = this.shadowRoot.querySelectorAll('#header-colgroup col');
            headerCols.forEach(col => {
                headerWidth += parseInt(col.style.width) || 150;
            });
            this.headerTable.style.width = `${headerWidth}px`;

            // 计算表体表格宽度
            let bodyWidth = 0;
            const bodyCols = this.shadowRoot.querySelectorAll('#body-colgroup col');
            bodyCols.forEach(col => {
                bodyWidth += parseInt(col.style.width) || 150;
            });
            this.bodyTable.style.width = `${bodyWidth}px`;

            // 同步滚动位置
            this.syncHeaderScroll();
        }

        initSortableTable() {
            const headers = this.shadowRoot.querySelectorAll('th');

            headers.forEach((header, index) => {
                header.addEventListener('click', (e) => {
                    const isMultiSort = e.shiftKey;
                    const type = header.getAttribute('data-type');
                    // const icon = header.querySelector('.sort-icon');

                    if (!isMultiSort || this.sortColumn !== index) {
                        this.sortDirection = this.sortColumn === index ?
                            (this.sortDirection === 'asc' ? 'desc' : 'asc') :
                            'asc';
                    }

                    this.sortColumn = index;

                    headers.forEach((h, i) => {
                        h.classList.remove('asc', 'desc');
                        if (i === index) {
                            h.classList.add(this.sortDirection);
                        }
                    });

                    this.sortTable(index, type, this.sortDirection);

                    this.dispatchEvent(new CustomEvent('sort', {
                        detail: {
                            column: index,
                            direction: this.sortDirection,
                            columnName: this.headers[index].text
                        }
                    }));
                });
            });
        }

        sortTable(column, type, direction) {
            const tableBody = this.shadowRoot.getElementById('table-body');
            const rows = Array.from(tableBody.querySelectorAll('tr'));

            rows.sort((a, b) => {
                const aValue = a.cells[column].textContent;
                const bValue = b.cells[column].textContent;

                let comparison = 0;

                switch (type) {
                    case 'number':
                        comparison = parseFloat(aValue) - parseFloat(bValue);
                        break;
                    case 'date':
                        comparison = new Date(aValue) - new Date(bValue);
                        break;
                    default:
                        comparison = aValue.localeCompare(bValue);
                }

                return direction === 'asc' ? comparison : -comparison;
            });

            while (tableBody.firstChild) {
                tableBody.removeChild(tableBody.firstChild);
            }

            rows.forEach(row => tableBody.appendChild(row));
        }
    }
    customElements.define('resizable-table', ResizableTable);
} else {
    console.log('[ResizableTable] 已注册，跳过重复定义');
}