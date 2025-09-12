// 绑定按钮点击事件
document.getElementById('cancelBtn').addEventListener('click', () => {
    window.electronAPI.send('cancel')
});

document.getElementById('confirmBtn').addEventListener('click', () => {
    window.electronAPI.send('confirm')
});

// 关闭按钮事件
document.getElementById('dialog-close').addEventListener('click', () => {
    window.electronAPI.send('close')
});

window.electronAPI.receiveConfig((action) => {
 
    document.getElementById('dialog-msg').textContent = action.message;

    if(action.showNotice){
        document.getElementById('img-notice-icon').style.display = 'block'
    }else{
        document.getElementById('img-notice-icon').style.display = 'none'
    }

});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.getElementById('dialog-close').click();
    }
})