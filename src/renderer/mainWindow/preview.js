// 获取元素
const container = document.querySelector('.container');
const text = document.querySelector('.text');
const arrow = document.querySelector('.arrow');

// 检测文本是否溢出
function checkOverflow() {
  const isOverflowing = text.scrollWidth > text.offsetWidth;
  arrow.classList.toggle('visible', isOverflowing && !container.classList.contains('expanded'));
}

// 初始化检测
checkOverflow();

// 窗口变化时重新检测
window.addEventListener('resize', checkOverflow);

// 点击箭头展开/折叠
arrow.addEventListener('click', () => {
  container.classList.toggle('expanded');
  checkOverflow(); // 更新箭头状态
});