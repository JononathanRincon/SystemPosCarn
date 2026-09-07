'use client';

import { useState, useCallback } from 'react';
import { Delete, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const PIN_LENGTH = 4;

export default function LoginPinPage() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < PIN_LENGTH) {
        const newPin = pin + digit;
        setPin(newPin);
        setError('');

        // Auto-submit al completar 4 dígitos
        if (newPin.length === PIN_LENGTH) {
          handleSubmit(newPin);
        }
      }
    },
    [pin]
  );

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const handleSubmit = async (pinValue: string) => {
    setLoading(true);
    try {
      // TODO: Integrar con /auth/pin-login del backend
      console.log('PIN ingresado:', pinValue);
      // Simular validación — se conectará al backend en TASK-23+
      await new Promise((resolve) => setTimeout(resolve, 500));
      setError('PIN no válido. Intente de nuevo.');
      setPin('');
    } catch {
      setError('Error de conexión');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto w-16 h-16 bg-carmin-500 rounded-2xl flex items-center justify-center mb-4">
          <span className="text-white text-3xl">🥩</span>
        </div>
        <h1 className="text-pos-xl font-bold text-white">POS Carnicería</h1>
        <p className="text-neutro-400 mt-2">Ingrese su PIN de 4 dígitos</p>
      </div>

      {/* PIN Dots */}
      <div className="flex gap-4 mb-8">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'w-5 h-5 rounded-full border-2 transition-all duration-200',
              i < pin.length
                ? 'bg-carmin-500 border-carmin-500 scale-110'
                : 'bg-transparent border-neutro-500'
            )}
          />
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-ambar-400 text-sm mb-4 animate-pulse">{error}</p>
      )}

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
        {digits.map((digit, i) => {
          if (digit === '') {
            // Posiciones 9 y 11: botones de acción
            if (i === 9) {
              return (
                <button
                  key="clear"
                  onClick={handleClear}
                  disabled={loading}
                  className="min-h-touch-lg rounded-2xl bg-neutro-700 text-neutro-300 
                             text-pos-base font-semibold
                             hover:bg-neutro-600 active:scale-95 
                             transition-all duration-100
                             flex items-center justify-center"
                  aria-label="Limpiar PIN"
                >
                  C
                </button>
              );
            }
            return (
              <button
                key="delete"
                onClick={handleDelete}
                disabled={loading}
                className="min-h-touch-lg rounded-2xl bg-neutro-700 text-neutro-300
                           hover:bg-neutro-600 active:scale-95
                           transition-all duration-100
                           flex items-center justify-center"
                aria-label="Borrar último dígito"
              >
                <Delete size={28} />
              </button>
            );
          }

          return (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              disabled={loading || pin.length >= PIN_LENGTH}
              className="min-h-touch-lg rounded-2xl bg-neutro-800 text-white
                         text-pos-xl font-bold
                         hover:bg-neutro-700 active:bg-carmin-700 active:scale-95
                         transition-all duration-100
                         disabled:opacity-50"
            >
              {digit}
            </button>
          );
        })}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="mt-6 flex items-center gap-2 text-neutro-400">
          <div className="w-4 h-4 border-2 border-carmin-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Verificando PIN...</span>
        </div>
      )}
    </div>
  );
}
