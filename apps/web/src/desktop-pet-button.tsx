import { useState } from 'react';
import { ArrowUpRight, PawPrint } from 'lucide-react';
import { localObservationBridge } from './local-observation';
import { announce, useApp } from './store';
import './desktop-pet-button.css';

export function DesktopPetButton({ onOpened }: { onOpened(): void }) {
  const [opening, setOpening] = useState(false);

  async function openPet() {
    if (opening) return;
    const bridge = localObservationBridge();
    if (!bridge) {
      useApp.setState({ error: '请在微光指引桌面客户端中打开桌宠，网页预览不支持悬浮桌宠。' });
      return;
    }
    setOpening(true);
    try {
      await bridge.showPet();
      onOpened();
      announce('桌宠已显示在桌面。');
    } catch (error) {
      useApp.setState({ error: error instanceof Error ? error.message : '桌宠未能打开，请重试。' });
    } finally {
      setOpening(false);
    }
  }

  return <button type="button" className="nav-item desktop-pet-button" onClick={() => void openPet()}
    disabled={opening} aria-busy={opening} title="显示桌宠，已最小化或关闭也可重新打开">
    <PawPrint size={22} aria-hidden="true"/><span>{opening ? '正在打开桌宠…' : '打开桌宠'}</span>
    <ArrowUpRight size={17} className="desktop-pet-open-icon" aria-hidden="true"/>
  </button>;
}
