const caption = document.getElementById('caption');
const unsubscribe = window.nuanbanCaption.onState(state => {
  caption.textContent = state.visible ? state.text : '';
  caption.hidden = !state.visible || !state.text;
});
window.addEventListener('beforeunload', () => { unsubscribe(); caption.textContent = ''; }, { once: true });
