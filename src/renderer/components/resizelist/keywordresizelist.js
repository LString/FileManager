if (!customElements.get('keyword-resizable-table')) {
    class KeyWordResizableTable extends HTMLElement {
        constructor() {
            super();
            this.attachShadow({ mode: 'open' });

            // 固定三列配置
            this.headers = [
                { key: 'keyword', text: '关键词', type: 'string' },
                { key: 'description', text: '关键词描述', type: 'string' },
                { key: 'fileCount', text: '文件数量', type: 'number' }
            ];
            this.initRatios = [1, 1.5, 0.8]; // 初始宽度比

            // 组件状态
            this.isResizing = false;
            this.currentHeader = null;
            this.startX = 0;
            this.startWidth = 0;
            this.sortColumn = null;
            this.sortDirection = null;
            this.tableData = [];
            this.originalData = [];
            this.columnWidths = {}; // 存储列宽度
            this.initializedWidths = false; // 标记是否已初始化宽度
            this.scrollbarWidth = 0; // 存储滚动条宽度

            // 渲染组件
            this.render();
        }

        connectedCallback() {
            // 获取表格元素引用
            this.headerTable = this.shadowRoot.getElementById('keyword-table-headers-table');
            this.headersRow = this.shadowRoot.getElementById('keyword-table-headers');
            this.bodyTable = this.shadowRoot.getElementById('keyword-table-body-table');
            this.colgroup = this.bodyTable.querySelector('colgroup');
            this.bodyContainer = this.shadowRoot.querySelector('.keyword-table-body-container');
            this.headerContainer = this.shadowRoot.querySelector('.keyword-table-header-container');
            this.tableContainer = this.shadowRoot.querySelector('.keyword-table-container');

            // 计算滚动条宽度并设置表头容器padding
            this.scrollbarWidth = this.bodyContainer.offsetWidth - this.bodyContainer.clientWidth;
            this.headerContainer.style.paddingRight = `${this.scrollbarWidth}px`;

            // 添加滚动同步监听
            this.bodyContainer.addEventListener('scroll', this.syncHeaderScroll.bind(this));
            // 添加 ResizeObserver 监听容器尺寸变化
            this.resizeObserver = new ResizeObserver(entries => {
                if (entries[0].contentRect.width > 0 && !this.initializedWidths) {
                    this.initColumnWidths(); // 仅在宽度有效时初始化
                }
            });
            this.resizeObserver.observe(this.tableContainer);
        }

        disconnectedCallback() {
            this.resizeObserver.disconnect(); // 防止内存泄漏
        }

        syncHeaderScroll() {
            this.headerContainer.scrollLeft = this.bodyContainer.scrollLeft;
        }

        setData(data) {
            if (!data) data = [];
            if (!Array.isArray(data)) {
                console.error('setData expects an array');
                return;
            }

            this.originalData = data;
            this.tableData = data.map(item => [
                item.keyword,
                item.description,
                item.fileCount
            ]);

            // 初始化列宽
            if (this.isConnected && this.initializedWidths) {
                this.renderHeaders();
                this.renderBody();
            }
        }

        initColumnWidths() {
            // 关键修改：使用 tableContainer 的宽度而不是减去滚动条宽度
            const containerWidth = this.tableContainer.clientWidth;

            // 关键修改：确保容器宽度有效
            if (containerWidth <= 0) {
                console.warn('Container width is invalid, using fallback width');
                return;
            }

            const totalRatio = this.initRatios.reduce((a, b) => a + b, 0);
            let accumulatedWidth = 0;
            const MIN_COLUMN_WIDTH = 120;

            // 计算比例宽度（保留最后列不取整）
            this.headers.forEach((header, index) => {
                // 最后一列使用剩余空间
                if (index === this.headers.length - 1) {
                    const remainingWidth = containerWidth - accumulatedWidth;
                    this.columnWidths[header.key] = Math.max(remainingWidth, MIN_COLUMN_WIDTH);
                } else {
                    // 按比例计算宽度（保留小数避免累计误差）
                    const exactWidth = (containerWidth * this.initRatios[index]) / totalRatio;

                    // 四舍五入取整
                    const roundedWidth = Math.round(exactWidth);

                    // 确保不小于最小宽度
                    this.columnWidths[header.key] = Math.max(roundedWidth, MIN_COLUMN_WIDTH);
                    accumulatedWidth += this.columnWidths[header.key];
                }
            });

            // 关键修改：添加防溢出检查
            const totalWidth = Object.values(this.columnWidths).reduce((a, b) => a + b, 0);
            if (totalWidth > containerWidth) {
                // 等比例压缩所有列
                const scaleFactor = containerWidth / totalWidth;
                this.headers.forEach(header => {
                    this.columnWidths[header.key] = Math.floor(this.columnWidths[header.key] * scaleFactor);
                });
            }

            this.initializedWidths = true;
            this.renderHeaders();
            this.renderBody();
        }

        render() {
            this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    overflow: hidden;
                }
                
                .keyword-table-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    overflow: hidden;
                    width: 100%;
                }
                
                .keyword-table-header-container {
                    overflow: hidden;
                    position: relative;
                    height: auto;
                }
                
                .keyword-table-body-container {
                    width: 100%;
                    flex: 1;
                    overflow: auto;
                }
                
                table {
                    border-spacing: 0;
                    table-layout: fixed;
                    width: 100%;
                }
                
                #keyword-table-headers-table {
                    border-collapse: collapse;
                }
        
                #keyword-table-headers-table,
                #keyword-table-body-table {
                    min-width: 100%;
                    table-layout: fixed;
                }
                
                thead {
                    position: sticky;
                    top: 0;
                    z-index: 100;
                }
                
                #keyword-table-headers-table th {
                    background: rgba(246, 246, 251, 1);;
                    position: relative;
                    cursor: pointer;
                    font-weight: 600;
                    color: rgba(0, 0, 0, 1);
                    font-size: 14px;
                    user-select: none;
                    transition: background 0.3s;
                    box-sizing: border-box;
                    text-align: left;
                    padding: 12px 16px;
                    border: 0.5px solid rgba(0, 0, 0, 0.2);
                    min-width: 80px;
                    max-width: 800px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                #keyword-table-headers-table th:hover {
                    background: rgba(219, 234, 255, 1);;
                }
                
                #keyword-table-body-table{
                    border-collapse: collapse; /* 分离边框模式 */
                    border-spacing: 0; /* 消除单元格间距 */
                }

                #keyword-table-body-table tr {
                    transition: background-color 0.2s;
                    border: 1px solid rgba(0, 0, 0, 0.2);
                }
                
                #keyword-table-body-table tr:hover {
                    background-color: #f5fbff;
                }
                
                #keyword-table-body-table td {
                    box-sizing: border-box;
                    padding: 1px 1px 1px 16px;
                    height: 47px;
                    min-width: 60px;
                    max-width: 800px;
                    overflow: hidden;
                    word-wrap: break-word;
                    white-space: normal;
                    border: none !important;
                }
                
                .sort-icon {
                    display: inline-block;
                    margin-left: 8px;
                    font-size: 14px;
                    transition: transform 0.2s;
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

                .keyword-drag-indicator {
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
                
                /* 自定义滚动条样式 */
                .keyword-table-body-container::-webkit-scrollbar {
                    width: 10px;
                    height: 10px;
                }
                
                .keyword-table-body-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                .keyword-table-body-container::-webkit-scrollbar-thumb {
                    background: #c1c1c1;
                    border-radius: 5px;
                }
                
                .keyword-table-body-container::-webkit-scrollbar-thumb:hover {
                    background: #a8a8a8;
                }

                .row-selected {
                    background-color: rgb(203, 223, 252) !important;
                    transition: background-color 0.3s ease;
                }

            </style>
            
            <div class="keyword-table-container">
                <div class="keyword-table-header-container">
                    <table id="keyword-table-headers-table">
                        <colgroup id="keyword-header-colgroup"></colgroup>
                        <thead>
                            <tr id="keyword-table-headers"></tr>
                        </thead>
                    </table>
                </div>
                <div class="keyword-table-body-container">
                    <table id="keyword-table-body-table">
                        <colgroup id="keyword-body-colgroup"></colgroup>
                        <tbody id="keyword-table-body"></tbody>
                    </table>
                </div>
            </div>
            <div class="keyword-drag-indicator" id="keyword-drag-indicator"></div>
        `;
        }


        renderHeaders() {
            const headersRow = this.shadowRoot.getElementById('keyword-table-headers');
            headersRow.innerHTML = '';

            const headerColgroup = this.shadowRoot.getElementById('keyword-header-colgroup');
            headerColgroup.innerHTML = '';

            // 计算总宽度
            let totalWidth = 0;

            this.headers.forEach(header => {
                // 创建列元素
                const col = document.createElement('col');
                const width = this.columnWidths[header.key] || 150;
                col.style.width = `${width}px`;
                headerColgroup.appendChild(col);

                // 创建表头单元格
                const th = document.createElement('th');
                th.textContent = header.text;
                th.setAttribute('data-type', header.type);
                th.setAttribute('data-key', header.key);
                th.style.width = `${width}px`;
                totalWidth += width;

                const sortIcon = document.createElement('span');
                sortIcon.classList.add('sort-icon');
                sortIcon.textContent = '↕';
                th.appendChild(sortIcon);

                const resizer = document.createElement('div');
                resizer.classList.add('resizer');
                th.appendChild(resizer);

                headersRow.appendChild(th);
            });

            // 设置表头表格宽度
            this.headerTable.style.width = `${totalWidth}px`;
            this.initResizableColumns();
            this.initSortableTable();
        }

        renderBody() {
            const tableBody = this.shadowRoot.getElementById('keyword-table-body');
            tableBody.innerHTML = '';

            const bodyColgroup = this.shadowRoot.getElementById('keyword-body-colgroup');
            bodyColgroup.innerHTML = '';

            // 计算总宽度
            let totalWidth = 0;
            this.headers.forEach(header => {
                const col = document.createElement('col');
                const width = this.columnWidths[header.key] || 150;
                col.style.width = `${width}px`;
                bodyColgroup.appendChild(col);
                totalWidth += width;
            });

            // 设置表体表格宽度
            this.bodyTable.style.width = `${totalWidth}px`;

            this.tableData.forEach((rowData, rowIndex) => {
                const row = document.createElement('tr');
                row.dataset.index = rowIndex;

                // 渲染三列数据
                this.headers.forEach((header, colIndex) => {
                    const cell = document.createElement('td');
                    cell.textContent = rowData[colIndex] || '';
                    row.appendChild(cell);
                });

                // 添加行点击事件
                row.addEventListener('click', (e) => {
                    // 如果点击的是操作按钮，则不触发行点击
                    if (e.target.closest('.action-btn')) return;

                    //清除之前的选中效果
                    const prevSelected = tableBody.querySelector('.row-selected');
                    if (prevSelected) {
                        prevSelected.classList.remove('row-selected');
                    }
                    // 选中当前行
                    row.classList.add('row-selected');
                    const originalData = this.originalData[rowIndex];
                    this.dispatchEvent(new CustomEvent('row-click', {
                        detail: {
                            data: originalData,
                            index: rowIndex
                        }
                    }));
                });

                tableBody.appendChild(row);
            });
        }

        initResizableColumns() {
            const headers = this.shadowRoot.querySelectorAll('th');
            const indicator = this.shadowRoot.getElementById('keyword-drag-indicator');

            headers.forEach(header => {
                const key = header.getAttribute('data-key');
                const resizer = header.querySelector('.resizer');

                resizer.addEventListener('mousedown', (e) => {
                    this.isResizing = true;
                    this.currentHeader = header;
                    this.startX = e.clientX;
                    this.startWidth = header.getBoundingClientRect().width;
                    resizer.classList.add('active');

                    this.columnWidths[key] = this.startWidth;
                    indicator.style.display = 'block';
                    indicator.style.left = e.clientX + 'px';

                    document.addEventListener('mousemove', this.doDrag);
                    document.addEventListener('mouseup', this.stopDrag);
                });
            });
        }

        doDrag = (e) => {
            if (!this.isResizing) return;

            const MIN_WIDTH = 120;
            const MAX_WIDTH = 800;
            let newWidth = this.startWidth + (e.clientX - this.startX);
            newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));

            // 更新当前列的宽度
            const key = this.currentHeader.getAttribute('data-key');
            this.currentHeader.style.width = `${newWidth}px`;
            this.columnWidths[key] = newWidth;

            // 更新列组
            const headerColgroup = this.shadowRoot.getElementById('keyword-header-colgroup');
            const headerCols = headerColgroup.querySelectorAll('col');
            const headerIndex = Array.from(this.currentHeader.parentElement.children).indexOf(this.currentHeader);
            if (headerCols[headerIndex]) {
                headerCols[headerIndex].style.width = `${newWidth}px`;
            }

            const bodyColgroup = this.shadowRoot.getElementById('keyword-body-colgroup');
            const bodyCols = bodyColgroup.querySelectorAll('col');
            if (bodyCols[headerIndex]) {
                bodyCols[headerIndex].style.width = `${newWidth}px`;
            }


            let totalWidth = Object.values(this.columnWidths).reduce((a, b) => a + b, 0);
            this.headerTable.style.width = `${totalWidth}px`;
            this.bodyTable.style.width = `${totalWidth}px`;

            const indicator = this.shadowRoot.getElementById('keyword-drag-indicator');
            indicator.style.left = e.clientX + 'px';
        };

        stopDrag = () => {
            if (!this.isResizing) return;

            this.isResizing = false;
            this.shadowRoot.querySelectorAll('.resizer').forEach(r => r.classList.remove('active'));
            this.shadowRoot.getElementById('keyword-drag-indicator').style.display = 'none';

            document.removeEventListener('mousemove', this.doDrag);
            document.removeEventListener('mouseup', this.stopDrag);
        };


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
                        const ic = h.querySelector('.sort-icon');
                        if (i === index) {
                            ic.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
                        } else if (!isMultiSort) {
                            ic.textContent = '↕';
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
            const tableBody = this.shadowRoot.getElementById('keyword-table-body');
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
    customElements.define('keyword-resizable-table', KeyWordResizableTable);
} else {
    console.log('[keyword-resizable-table] 已注册，跳过重复定义');
}