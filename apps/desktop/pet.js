const messages = [
  '我在这里陪你学习',
  '不用着急，我们一步一步来',
  '需要我时，点一下打开暖伴',
];
const message = document.getElementById('message');
let messageIndex = 0;

document.getElementById('open-main').addEventListener('click', () => {
  void window.nuanbanPet.openMain();
});

document.getElementById('close-pet').addEventListener('click', () => {
  void window.nuanbanPet.close();
});

document.querySelector('.pet-window').addEventListener('contextmenu', event => {
  event.preventDefault();
  void window.nuanbanPet.showMenu();
});

document.querySelector('.pet-stage').addEventListener('dblclick', () => {
  void window.nuanbanPet.openMain();
});

window.setInterval(() => {
  messageIndex = (messageIndex + 1) % messages.length;
  message.textContent = messages[messageIndex];
}, 9000);
