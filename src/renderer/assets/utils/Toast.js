function showErrorToast(title, error) {
    console.error(`${title}:`, error);
    Toastify({
        text: `${title}: ${error.message}`,
        duration: 3000,
        backgroundColor: "linear-gradient(to right, #ff5f6d, #ffc371)"
    }).showToast();
}

module.exports = showErrorToast