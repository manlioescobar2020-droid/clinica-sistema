/**
 * Genera una cadena CSV separada por punto y coma para compatibilidad con Excel en español.
 * - Separador: ; (Excel español/latinoamérica usa ; por su configuración regional)
 * - BOM UTF-8 (\uFEFF) para que Excel detecte tildes y ñ correctamente
 * - Todos los valores entre comillas dobles; las comillas internas se duplican ("")
 * - CRLF como fin de línea (RFC 4180)
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const quote = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const line  = (cells: string[]) => cells.map(quote).join(";")
  const body  = [line(headers), ...rows.map(line)].join("\r\n")
  return "\uFEFF" + body
}
