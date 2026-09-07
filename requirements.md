# Requirements Document — Sistema POS Multi-Sucursal para Carnicerías
**Especificación Conceptual y Requerimientos Funcionales (EARS)**

> **Propósito:** Este documento define exclusivamente las reglas de negocio, historias de usuario y comportamiento funcional esperado sin atarse a código ni tecnologías de implementación. Es la fuente de verdad conceptual para el agente de desarrollo.

---

## 1. Contexto y Modelo de Negocio

El sistema resuelve tres problemáticas críticas de carnicerías y frigoríficos:
1. **Continuidad Operativa Offline:** La caída del servicio de internet no debe suspender la venta, pesaje ni emisión de comprobantes en mostrador.
2. **Venta Mixta (Peso y Unidad) con Trazabilidad Decimal:** Venta con balanzas conectadas al gramo (`decimal(10,3)`), con tara de empaque y seguimiento de mermas operativas (desposte, evaporación, hueso/grasa).
3. **Control Multi-Sucursal y por Lote (FEFO):** Monitoreo consolidado de inventarios, recepción de mercancía por lotes y despacho automático por fecha de caducidad más cercana (First Expired, First Out).

---

## 2. Historias de Usuario (User Stories)

### 2.1 Cajero / Operador de Mostrador
- **US-01:** *Como cajero*, quiero ingresar al POS mediante un PIN de 4 dígitos sin conexión a internet, para iniciar turno en menos de 5 segundos.
- **US-02:** *Como cajero*, quiero capturar el peso exacto directamente desde la báscula, para evitar digitación manual y errores de cobro.
- **US-03:** *Como cajero*, quiero vender productos por peso (kg) o por unidad en una misma transacción, para cobrar carnes y abarrotes juntos.
- **US-04:** *Como cajero*, quiero registrar pagos mixtos (efectivo, tarjeta, transferencia), para dar flexibilidad al cliente y cuadrar el dinero.
- **US-05:** *Como cajero*, quiero seguir vendiendo de forma transparente aunque no haya internet, sin perder transacciones ni congelar la terminal.
- **US-06:** *Como cajero*, quiero realizar el corte de caja al finalizar jornada, comparando el dinero físico contra el esperado por el sistema.

### 2.2 Gerente de Sucursal
- **US-07:** *Como gerente*, quiero registrar mermas operativas clasificadas por motivo (corte, vencimiento, daño), para mantener el stock real.
- **US-08:** *Como gerente*, quiero recibir alertas cuando el inventario llegue al stock mínimo, para reabastecer a tiempo.
- **US-09:** *Como gerente*, quiero auditar los cortes de caja y diferencias de efectivo por turno y cajero.
- **US-14:** *Como gerente*, quiero ver un resumen operativo de mi sucursal al entrar al sistema (ventas del turno, caja, inventario crítico).
- **US-15:** *Como gerente*, quiero registrar la recepción de mercancía creando lotes con costo, proveedor y vencimiento.
- **US-16:** *Como gerente*, quiero visualizar el saldo disponible de cada lote y cuáles están próximos a vencer (≤ 3 días).

### 2.3 Dueño / Administrador General
- **US-10:** *Como dueño*, quiero gestionar múltiples sucursales y sus cajas desde el panel web de forma centralizada.
- **US-11:** *Como dueño*, quiero actualizar precios de catálogo en la web y que se distribuyan a todas las cajas automáticamente.
- **US-12:** *Como dueño*, quiero consultar reportes consolidados y márgenes de ganancia por sucursal y categoría cárnica.
- **US-13:** *Como dueño*, quiero un dashboard financiero al iniciar sesión con ventas del día, márgenes, alertas y comparativos.
- **US-17:** *Como dueño*, quiero consultar el margen real por lote (costo de compra vs. precio de venta efectivo).
- **US-18:** *Como cajero*, quiero que el sistema descuente automáticamente del lote que vence primero (FEFO) sin pasos manuales.

---

## 3. Requisitos Funcionales bajo Sintaxis EARS

### 3.1 Autenticación y Seguridad
- **EARS-AUTH-01 (Ubicuo):** El sistema cifrará todas las contraseñas de usuario mediante bcrypt con factor de costo mínimo de 10 antes de persistirlas.
- **EARS-AUTH-02 (Event-driven):** Cuando un usuario ingrese credenciales válidas en la web, el sistema generará y retornará un Access Token JWT (expiración 15 min) y un Refresh Token (7 días).
- **EARS-AUTH-03 (State-driven):** Mientras el dispositivo POS opere offline, el sistema validará el acceso del cajero exclusivamente contra el hash del PIN local de 4 dígitos.
- **EARS-AUTH-04 (Unwanted behavior):** Si un usuario ingresa un PIN incorrecto más de 3 veces consecutivas, el sistema bloqueará el acceso local durante 60 segundos.
- **EARS-AUTH-05 (Optional):** Donde el usuario active "Mantener caja abierta en descanso", el sistema solicitará únicamente el PIN de 4 dígitos para desbloquear la terminal.

### 3.2 Venta, Pesaje y Facturación (Core POS)
- **EARS-VENTA-01 (Ubicuo):** El sistema calculará el total de cada línea multiplicando cantidad (kg con 3 decimales) por precio unitario, redondeando a 2 decimales monetarios.
- **EARS-VENTA-02 (Event-driven):** Cuando el cajero seleccione un producto de tipo peso, el sistema solicitará la lectura en tiempo real de la báscula conectada y actualizará el campo de peso.
- **EARS-VENTA-03 (State-driven):** Mientras una venta permanezca en borrador, el sistema recalculará dinámicamente el subtotal, descuentos y total general ante cualquier cambio.
- **EARS-VENTA-04 (Unwanted behavior):** Si el monto acumulado en métodos de pago es menor que el total de la venta, el sistema impedirá la confirmación del ticket y mostrará el saldo faltante.
- **EARS-VENTA-05 (Optional):** Donde el cliente solicite venta a crédito ("fiado"), el sistema validará que el cliente exista y que el saldo pendiente no exceda su límite de crédito asignado.

### 3.3 Inventario, Mermas y Lotes (FEFO)
- **EARS-INV-01 (Ubicuo):** El sistema registrará cada cambio de stock en `MovimientoInventario` utilizando exclusivamente valores delta (negativos para salidas, positivos para entradas).
- **EARS-INV-02 (Event-driven):** Cuando se complete exitosamente una venta, el sistema generará automáticamente movimientos delta negativos por cada línea vendida.
- **EARS-INV-03 (State-driven):** Mientras el stock actual sea $\le$ a su cantidad mínima de alerta, el sistema mostrará un indicador visual de stock bajo.
- **EARS-INV-04 (Unwanted behavior):** Si un ajuste de inventario o merma no incluye un motivo válido del catálogo permitido, el sistema rechazará la transacción.
- **EARS-INV-05 (Optional):** Donde se adjunte fotografía como evidencia de merma, el sistema almacenará la imagen y vinculará la URL al registro.
- **EARS-LOTE-01 (Ubicuo):** El sistema rastreará cada entrada a nivel de lote individual, registrando cantidad recibida, disponible, costo unitario, proveedor y vencimiento.
- **EARS-LOTE-02 (Event-driven):** Cuando se complete una venta de un producto con lotes activos, el sistema descontará la cantidad vendida siguiendo la estrategia FEFO (First Expired, First Out).
- **EARS-LOTE-03 (State-driven):** Mientras un lote tenga vencimiento dentro de los próximos 3 días calendario, el sistema mostrará alerta de "Próximo a Vencer" en ámbar.
- **EARS-LOTE-04 (Unwanted behavior):** Si la cantidad disponible de un lote llega a 0.000, el sistema cambiará automáticamente su estado a `agotado` e impedirá su selección.
- **EARS-LOTE-05 (Optional):** Donde la temperatura de recepción registrada exceda los 4°C en refrigerados, el sistema advertirá sobre posible ruptura de cadena de frío.

### 3.4 Sincronización Offline-First
- **EARS-SYNC-01 (Ubicuo):** El sistema asignará a cada venta, movimiento de inventario y corte de caja un identificador UUIDv4 generado en el dispositivo antes de persistirlo localmente.
- **EARS-SYNC-02 (Event-driven):** Cuando el POS detecte restablecimiento de internet, iniciará en segundo plano el envío del lote de transacciones acumuladas en la cola outbox.
- **EARS-SYNC-03 (State-driven):** Mientras el dispositivo opere sin conexión, mostrará un badge persistente con "Modo Sin Conexión" y el contador de registros pendientes.
- **EARS-SYNC-04 (Unwanted behavior):** Si el servidor recibe una venta cuyo UUID ya fue registrado previamente, responderá con HTTP 200 reconociendo la operación pero omitirá la re-inserción (idempotencia estricta).
- **EARS-SYNC-05 (Optional):** Donde dos terminales offline vendan el mismo producto provocando stock consolidado negativo, el sistema emitirá alerta en el panel admin sin anular las ventas ya efectuadas.

### 3.5 Corte y Cuadre de Caja
- **EARS-CAJA-01 (Ubicuo):** El sistema mantendrá el desglose acumulado de ventas por método de pago de forma independiente para cada caja activa.
- **EARS-CAJA-02 (Event-driven):** Cuando el cajero envíe el monto de efectivo contado al cerrar turno, el sistema calculará la diferencia aritmética inmutable (`contado - esperado`).
- **EARS-CAJA-03 (Unwanted behavior):** Si un cajero intenta registrar una venta sin haber realizado previamente la apertura de turno con base inicial, el sistema bloqueará la pantalla de venta.
- **EARS-CAJA-04 (State-driven):** Mientras una caja se encuentre en estado `cerrada`, el sistema impedirá transacciones de venta en ese dispositivo.
- **EARS-CAJA-05 (Optional):** Donde el gerente autorice ingreso adicional de efectivo a una caja abierta, el sistema registrará ajuste de base sin alterar totales de venta.

### 3.6 Dashboard y Reportes
- **EARS-DASH-01 (Ubicuo):** El sistema calculará los indicadores financieros del dashboard utilizando exclusivamente datos sincronizados en el servidor, mostrando la marca de tiempo de la última sync.
- **EARS-DASH-02 (Event-driven):** Cuando un dueño o gerente inicie sesión web, el sistema cargará su respectivo dashboard como pantalla de inicio predeterminada.
- **EARS-DASH-03 (State-driven):** Mientras existan lotes vencidos en estado activo, el sistema mostrará alerta prioritaria en el dashboard.

---

## 4. Casos Límite (Edge Cases)

1. **Pérdida de señal de báscula durante pesaje:** Se bloquea el cobro y no se permite agregar línea con 0.000 kg. Requiere reintento o ingreso manual por supervisor.
2. **Pesos infinitesimales (< 0.001 kg):** Redondeo a 3 decimales; si resulta 0.000 kg no se permite agregar al carrito.
3. **Venta con lotes agotados:** Alerta visual, pero venta permitida bajo permiso de supervisor (genera delta negativo sin `lote_id` y alerta de stock negativo post-sync).
4. **Lote vencido con saldo:** Cambio automático a `vencido`, exclusión de FEFO y alerta para merma.
5. **Recepción simultánea offline:** Cada dispositivo genera lote con UUID único; al sincronizar coexisten sin colisión.
6. **Apagón repentino durante cobro:** Transacción atómica local; si se corta antes del commit, el carrito se rescata como borrador al reabrir.
