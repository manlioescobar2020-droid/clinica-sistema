"use client"

import { useState } from "react"

interface MercadoPagoButtonProps {
  appointmentId: string
  defaultAmount?: number
}

export function MercadoPagoButton({ appointmentId, defaultAmount = 0 }: MercadoPagoButtonProps) {
  const [amount, setAmount] = useState(defaultAmount > 0 ? String(defaultAmount) : "")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePagar() {
    const parsedAmount = parseFloat(amount)
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Ingresá un monto válido mayor a 0")
      return
    }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch("/api/pagos/crear-preferencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, amount: parsedAmount }),
      })

      // Intentar parsear JSON incluso en errores para obtener el mensaje exacto
      let data: { error?: string; checkoutUrl?: string } = {}
      try {
        data = await res.json()
      } catch {
        setError(`Error del servidor (status ${res.status}). Revisá los logs de Vercel.`)
        return
      }

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status} al crear preferencia de pago`)
        return
      }

      if (!data.checkoutUrl) {
        setError("La API no devolvió una URL de pago. Revisá los logs de Vercel.")
        return
      }

      window.location.href = data.checkoutUrl
    } catch (e) {
      setError(`Error de red: ${e instanceof Error ? e.message : "sin conexión"}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-500">Monto a cobrar ($)</label>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={loading}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handlePagar}
        disabled={loading || !amount}
        className="w-full bg-[#009EE3] hover:bg-[#0080BA] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Generando link...
          </>
        ) : (
          "Pagar con Mercado Pago"
        )}
      </button>
    </div>
  )
}
