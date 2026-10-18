let clicks = 0;
document.getElementById('target').addEventListener('click', () => { clicks += 1; document.getElementById('count').textContent = String(clicks); });
