document.getElementById('stop').addEventListener('click', () => { void window.nuanbanC02.stop().catch(() => { document.getElementById('stop').textContent = '请关闭验证程序'; }); });
