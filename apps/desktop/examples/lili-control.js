export async function runLiliExample(bridge, onEvent = () => {}) {
  const unsubscribe = bridge.onEvent(onEvent);
  try {
    const selected = await bridge.select(true);
    if (!selected.ok) throw new Error(`栗栗未启用：${selected.code}`);
    const description = await bridge.command({ type: 'resource.describe' });
    if (!description.ok) throw new Error(`栗栗资源不可用：${description.code}`);
    const action = await bridge.command({ type: 'action.play', action: 'wave' });
    if (!action.ok) throw new Error(`栗栗动作未播放：${action.code}`);
    const semantic = await bridge.command({ type: 'semantic.send', name: 'listening', text: '我在认真听，慢慢来。' });
    if (!semantic.ok) throw new Error(`栗栗语义事件未接受：${semantic.code}`);
    return { resource: description.resource, action, unsubscribe };
  } catch (error) {
    unsubscribe();
    throw error;
  }
}
