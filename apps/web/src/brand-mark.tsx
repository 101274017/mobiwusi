import brandMarkUrl from './assets/brand-mark.svg';

type BrandMarkProps = {
  className?: string;
  size?: number;
};

/**
 * 微光指引品牌标识：以鹿角光标表达栗栗陪用户找到界面目标。
 * 图形源文件统一保存在 design/brand/。
 */
export function BrandMark({ className, size = 48 }: BrandMarkProps) {
  return (
    <img className={className} width={size} height={size} src={brandMarkUrl} alt="" aria-hidden="true" draggable={false} />
  );
}
