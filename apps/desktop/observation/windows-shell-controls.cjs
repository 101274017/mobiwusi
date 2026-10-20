const { ObservationError } = require('./observation-common.cjs');

const labels = new Set(['微信', '开始', '搜索', '此电脑', '回收站', '控制面板']);

function checkedShellControls(controls, geometry) {
  if (controls === undefined) return [];
  if (!Array.isArray(controls) || controls.length > 128) throw new ObservationError('shell_controls_invalid');
  if (controls.length && !geometry) throw new ObservationError('shell_controls_unrequested');
  return controls.map(control => {
    if (!control || !labels.has(control.label) || !['taskbar', 'desktop'].includes(control.surface)) throw new ObservationError('shell_controls_invalid');
    const rect = control.rect;
    if (!rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0 || rect.height <= 0 || rect.x < geometry.pixelX || rect.y < geometry.pixelY
      || rect.x + rect.width > geometry.pixelX + geometry.pixelWidth
      || rect.y + rect.height > geometry.pixelY + geometry.pixelHeight) throw new ObservationError('shell_controls_out_of_bounds');
    return { label: control.label, surface: control.surface,
      rect: { x: rect.x - geometry.pixelX, y: rect.y - geometry.pixelY, width: rect.width, height: rect.height } };
  });
}

module.exports = { checkedShellControls };
