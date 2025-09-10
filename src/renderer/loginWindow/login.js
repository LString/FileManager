document.addEventListener('DOMContentLoaded', () => {
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
    const closeBtn = getElement('close')

    // 验证API可用性
    if (!window.electronAPI) {
        console.error('[致命错误] electronAPI 未定义!')
        return
    }

    // // 最小化按钮
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

    document.getElementById('btn-login').addEventListener('click', function (event) {

        event.preventDefault(); // 阻止默认表单提交行为

        const userName = document.getElementById('login-username');
        const passWord = document.getElementById('login-password');

        // 使用更精确的空值判断
        const isUsernameEmpty = userName.value.trim() === "";
        const isPasswordEmpty = passWord.value.trim() === "";

        if (isUsernameEmpty || isPasswordEmpty) {
            return;
        }

        const userData = {
            username: userName.value.trim(),
            password: passWord.value.trim()
        };
        console.log('userdata username ========== ' + userData.username)
        console.log('userdata password ========== ' + userData.password)
        // 验证密码
        let result = window.electronAPI.db.login(userData)

        if (!result) {
            showConfirmDialog('用户名或密码错误')
        }

    });

    document.getElementById('showPassword').addEventListener('click', async (e) => {
        const input = document.getElementById('login-password');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const loginBtn = document.getElementById('btn-login');
            if (loginBtn) loginBtn.click();
        }
    });

    async function showConfirmDialog(msg, show = false) {
        const result = await window.electronAPI.showDialog({ message: msg, showNotice: show });//返回confirm/cancel/close
        console.log('result == ' + result)
        return result === 'confirm';
    }
})