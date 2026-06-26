/**
 * 金额精度处理工具
 * 所有内部计算使用整数分（×100），显示时保留2位小数
 */

/** 元转分 */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100)
}

/** 分转元 */
export function fenToYuan(fen: number): number {
  return Math.round(fen) / 100
}

/** 格式化为显示用的金额字符串（保留2位小数） */
export function formatYuan(fen: number): string {
  return (Math.round(fen) / 100).toFixed(2)
}

/** 分转元并格式化 */
export function fenToDisplay(fen: number): string {
  return formatYuan(fen)
}

/** 解析用户输入的金额字符串为分 */
export function parseToYuan(input: string): number {
  const n = parseFloat(input)
  return isNaN(n) ? 0 : Math.round(n * 100) / 100
}
