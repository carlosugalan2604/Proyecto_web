// cliente.js — Lógica del panel del cliente
// Autor: Carlos Ugarte Galán

// Dirección donde está escuchando la API Spring Boot
const API_URL = 'http://localhost:8085';

// Arrays donde guardamos los datos que vendrán de la API
let misPedidos = []; // Los pedidos del cliente logueado
let productos  = []; // El catálogo de productos (necesario para mostrar nombre y precio en el detalle)

// Filtro activo para la lista de pedidos (por defecto mostramos todos)
let filtroPedido = 'todos';

// =====================================================================
// INICIALIZACIÓN — Se ejecuta cuando la página termina de cargar
// =====================================================================

document.addEventListener('DOMContentLoaded', async function() {
    cargarSesion();              // Verificamos que hay sesión activa
    await cargarDatosIniciales(); // Cargamos pedidos y productos desde la API
});

/*
 * cargarDatosIniciales()
 * -----------------------
 * Carga en paralelo los pedidos del cliente y el catálogo de productos.
 * Usamos Promise.all para no tener que esperar a que termine una petición
 * antes de empezar la otra (más eficiente).
 *
 * Después de cargar los datos:
 *   - Pintamos las estadísticas resumen (total, en proceso, entregados, gastado)
 *   - Pintamos la lista de pedidos
 */
async function cargarDatosIniciales() {
    const idUsuario = sessionStorage.getItem('usuario_id');
    try {
        // Hacemos las dos peticiones a la vez y esperamos a que ambas terminen
        const [pedidosAPI, productosAPI] = await Promise.all([
            fetch(API_URL + '/api/pedidos/usuario/' + idUsuario).then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/productos').then(function(r) { return r.json(); })
        ]);

        // Adaptamos los nombres de campo de la API al formato interno del JS
        // La API usa 'idPedido', 'fechaPedido', 'importeTotal' y nosotros usamos 'id', 'fecha', 'importe'
        misPedidos = pedidosAPI.map(function(p) {
            return {
                id:      p.idPedido,
                fecha:   p.fechaPedido,
                estado:  p.estado,
                importe: p.importeTotal
            };
        });

        // Los productos los guardamos tal cual, los necesitamos para cruzar con las líneas de pedido
        productos = productosAPI;

        renderStats();   // Mostramos los números de resumen
        renderPedidos(); // Mostramos la lista de pedidos

    } catch (e) {
        // Si la API falla, mostramos error en la zona de pedidos
        console.error('Error al cargar datos:', e);
        document.getElementById('pedidosLista').innerHTML =
            '<p style="color:#ef4444;padding:20px">Error al conectar con el servidor. ¿Está la API arrancada?</p>';
    }
}

// =====================================================================
// GESTIÓN DE SESIÓN
// =====================================================================

/*
 * cargarSesion()
 * ---------------
 * Comprueba si el usuario está logueado mirando en sessionStorage.
 * Si no hay sesión activa, redirige al login.
 * Si hay sesión, muestra el saludo y la fecha de hoy.
 */
function cargarSesion() {
    const nombre = sessionStorage.getItem('usuario_nombre');
    if (!nombre) { window.location.href = 'login.html'; return; }

    // Mostramos el nombre del cliente en el topbar
    document.getElementById('saludoTexto').textContent = 'Hola, ' + nombre;

    // Mostramos la fecha de hoy en formato legible (ej: "jueves, 25 de abril")
    document.getElementById('saludoFecha').textContent = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

/*
 * cerrarSesion()
 * ---------------
 * Borra los datos de sesión y vuelve al login.
 */
function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// =====================================================================
// ESTADÍSTICAS DEL CLIENTE
// =====================================================================

/*
 * renderStats()
 * --------------
 * Calcula y muestra las 4 tarjetas de estadísticas del cliente:
 *   1. Total de pedidos realizados
 *   2. Pedidos actualmente en proceso
 *   3. Pedidos ya entregados
 *   4. Total gastado (solo de pedidos entregados)
 *
 * Genera el HTML dinámicamente con template literals.
 */
function renderStats() {
    const total      = misPedidos.length;

    // Contamos los pedidos por estado
    const enProceso  = misPedidos.filter(function(p) { return p.estado === 'EN_PROCESO'; }).length;
    const entregados = misPedidos.filter(function(p) { return p.estado === 'ENTREGADO';  }).length;

    // Sumamos el importe de todos los pedidos entregados
    let gastado = 0;
    misPedidos.filter(function(p) { return p.estado === 'ENTREGADO'; })
              .forEach(function(p) { gastado += p.importe; });

    // Generamos el HTML con las 4 tarjetas de estadísticas
    document.getElementById('statsRow').innerHTML = `
        <div class="stat-item">
            <div class="stat-icono stat-azul"><i class="fas fa-shopping-bag"></i></div>
            <div><p class="stat-valor">${total}</p><p class="stat-label">Pedidos totales</p></div>
        </div>
        <div class="stat-item">
            <div class="stat-icono stat-naranja"><i class="fas fa-clock"></i></div>
            <div><p class="stat-valor">${enProceso}</p><p class="stat-label">En proceso</p></div>
        </div>
        <div class="stat-item">
            <div class="stat-icono stat-verde"><i class="fas fa-circle-check"></i></div>
            <div><p class="stat-valor">${entregados}</p><p class="stat-label">Entregados</p></div>
        </div>
        <div class="stat-item">
            <div class="stat-icono stat-azul-medio"><i class="fas fa-euro-sign"></i></div>
            <div><p class="stat-valor">€ ${gastado.toFixed(2)}</p><p class="stat-label">Total gastado</p></div>
        </div>`;
}

// =====================================================================
// LISTADO DE PEDIDOS
// =====================================================================

/*
 * renderPedidos()
 * ----------------
 * Filtra y muestra la lista de pedidos según:
 *   - El filtro de estado activo (todos / en proceso / entregado / cancelado)
 *   - El texto escrito en el buscador (busca por número o por fecha)
 *
 * Genera una tarjeta por cada pedido con su estado, fecha, importe y botón de detalle.
 */
function renderPedidos() {
    // Leemos el texto del buscador (en minúsculas para comparar sin importar mayúsculas)
    const busqueda = document.getElementById('busquedaPedidos').value.toLowerCase();

    // Filtramos los pedidos que cumplen ambas condiciones (estado Y texto de búsqueda)
    const lista = misPedidos.filter(function(p) {
        const coincideEstado = filtroPedido === 'todos' || p.estado === filtroPedido;
        const coincideTexto  = !busqueda || String(p.id).includes(busqueda) || p.fecha.includes(busqueda);
        return coincideEstado && coincideTexto;
    });

    const contenedor = document.getElementById('pedidosLista');

    // Si no hay pedidos con el filtro aplicado, mostramos mensaje de vacío
    if (lista.length === 0) {
        contenedor.innerHTML = '<div class="pedidos-vacio"><i class="fas fa-box-open"></i><p>No hay pedidos con el filtro seleccionado.</p></div>';
        return;
    }

    // Generamos el HTML de cada tarjeta de pedido
    let html = '';
    lista.forEach(function(p) {
        let clase, texto, icono;

        // Elegimos la clase CSS, el texto y el icono según el estado del pedido
        if (p.estado === 'EN_PROCESO')      { clase = 'estado-proceso';   texto = 'En Proceso'; icono = 'fa-clock';        }
        else if (p.estado === 'ENTREGADO')  { clase = 'estado-entregado'; texto = 'Entregado';  icono = 'fa-circle-check'; }
        else                                { clase = 'estado-cancelado'; texto = 'Cancelado';  icono = 'fa-circle-xmark'; }

        // padStart formatea el id con ceros a la izquierda: 1 → 0001, 23 → 0023
        html += `
            <div class="pedido-card">
                <div class="pedido-card-izq">
                    <div class="pedido-num">
                        <span class="pedido-id">#${String(p.id).padStart(4, '0')}</span>
                        <span class="pedido-fecha"><i class="fas fa-calendar-alt"></i> ${p.fecha}</span>
                    </div>
                    <span class="pedido-estado ${clase}"><i class="fas ${icono}"></i> ${texto}</span>
                </div>
                <div class="pedido-card-der">
                    <p class="pedido-importe">€ ${p.importe.toFixed(2)}</p>
                    <!-- Al pulsar este botón se abre el modal con el detalle del pedido -->
                    <button class="btn-ver-detalle" onclick="verDetalle(${p.id})">
                        Ver detalle <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>`;
    });
    contenedor.innerHTML = html;
}

/*
 * setFiltroPedido(filtro, el)
 * ----------------------------
 * Cambia el filtro activo de la lista de pedidos y la repinta.
 * También actualiza el estilo del botón de filtro seleccionado (activo/inactivo).
 *
 * Parámetros:
 *   filtro → valor del filtro ('todos', 'EN_PROCESO', 'ENTREGADO', 'CANCELADO')
 *   el     → el elemento botón que se ha pulsado (para ponerle la clase 'activo')
 */
function setFiltroPedido(filtro, el) {
    filtroPedido = filtro; // Guardamos el filtro activo

    // Quitamos 'activo' de todos los botones de filtro
    document.querySelectorAll('.filtro-btn-cli').forEach(function(b) { b.classList.remove('activo'); });

    // Añadimos 'activo' solo al botón que se ha pulsado
    el.classList.add('activo');

    // Repintamos la lista con el nuevo filtro aplicado
    renderPedidos();
}

// =====================================================================
// MODAL DE DETALLE DEL PEDIDO
// =====================================================================

/*
 * verDetalle(id)
 * ---------------
 * Abre el modal con el detalle de un pedido concreto.
 * Carga las líneas del pedido desde la API y las cruza con el catálogo
 * de productos para obtener el nombre y precio de cada producto.
 *
 * Pasos:
 *   1. Muestra el modal con un mensaje "Cargando..."
 *   2. Pide a la API las líneas del pedido (id_pedido + id_producto + cantidad)
 *   3. Para cada línea, busca el producto en el array 'productos' para obtener nombre y precio
 *   4. Genera la tabla con los datos y la muestra en el modal
 *
 * Parámetros:
 *   id → identificador del pedido a mostrar
 */
async function verDetalle(id) {
    // Buscamos el pedido en el array local para tener su estado e importe
    const p = misPedidos.find(function(x) { return x.id === id; });

    let clase, texto, icono;
    // Preparamos el badge de estado para mostrar en el modal
    if (p.estado === 'EN_PROCESO')      { clase = 'estado-proceso';   texto = 'En Proceso'; icono = 'fa-clock';        }
    else if (p.estado === 'ENTREGADO')  { clase = 'estado-entregado'; texto = 'Entregado';  icono = 'fa-circle-check'; }
    else                                { clase = 'estado-cancelado'; texto = 'Cancelado';  icono = 'fa-circle-xmark'; }

    // Ponemos el título del modal y mostramos un mensaje de carga mientras esperamos a la API
    document.getElementById('modalTitulo').textContent = 'Pedido #' + String(p.id).padStart(4, '0') + ' — ' + p.fecha;
    document.getElementById('modalBody').innerHTML = '<p style="padding:20px;color:#64748b">Cargando líneas...</p>';

    // Mostramos el modal (overlay + modal)
    document.getElementById('modalOverlay').classList.add('modal-visible');
    document.getElementById('modalDetalle').classList.add('modal-visible');

    try {
        // Pedimos las líneas del pedido a la API
        // Cada línea tiene: id.idPedido, id.idProducto, cantidad
        const lineasAPI = await fetch(API_URL + '/api/pedidos/' + id + '/productos').then(function(r) { return r.json(); });

        // Construimos las filas de la tabla cruzando las líneas con el catálogo de productos
        let filas = '';
        lineasAPI.forEach(function(l) {
            // Buscamos el producto en el array para obtener su nombre y precio
            const prod    = productos.find(function(x) { return x.idProducto === l.id.idProducto; });
            const nombre  = prod ? prod.nombre  : 'Producto #' + l.id.idProducto; // Fallback si no existe
            const precio  = prod ? prod.precio  : 0;
            const subtotal = (l.cantidad * precio).toFixed(2); // Precio × cantidad, redondeado a 2 decimales

            filas += `<tr>
                <td>${nombre}</td>
                <td style="text-align:center">${l.cantidad}</td>
                <td style="text-align:right">€ ${precio.toFixed(2)}</td>
                <td style="text-align:right"><strong>€ ${subtotal}</strong></td>
            </tr>`;
        });

        // Mensaje de estado al pie del modal (diferente según si está en proceso, entregado o cancelado)
        let mensaje;
        if (p.estado === 'EN_PROCESO')     mensaje = '<i class="fas fa-truck"></i> Tu pedido está siendo preparado.';
        else if (p.estado === 'ENTREGADO') mensaje = '<i class="fas fa-circle-check"></i> Pedido entregado. ¡Gracias!';
        else                               mensaje = '<i class="fas fa-circle-xmark"></i> Este pedido fue cancelado.';

        // Clase CSS para el mensaje de estado (cambia el color de fondo)
        const claseMsg = 'detalle-mensaje-' + p.estado.toLowerCase().replace('_', '-');

        // Generamos el HTML completo del modal con la tabla y el mensaje
        document.getElementById('modalBody').innerHTML = `
            <div class="detalle-estado">
                <span class="pedido-estado ${clase}"><i class="fas ${icono}"></i> ${texto}</span>
                <span style="font-size:0.8rem;color:#64748b">Importe total: <strong>€ ${p.importe.toFixed(2)}</strong></span>
            </div>
            <table class="tabla-detalle">
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th style="text-align:center">Cant.</th>
                        <th style="text-align:right">Precio</th>
                        <th style="text-align:right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;font-weight:700;padding:12px 16px">TOTAL</td>
                        <td style="text-align:right;font-weight:800;font-size:1.05rem;padding:12px 16px">€ ${p.importe.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            <div class="detalle-mensaje ${claseMsg}">${mensaje}</div>`;

    } catch (e) {
        // Si falla la carga de líneas, mostramos un mensaje de error
        document.getElementById('modalBody').innerHTML =
            '<p style="color:#ef4444;padding:20px">Error al cargar el detalle del pedido.</p>';
    }
}

/*
 * cerrarModal()
 * --------------
 * Cierra el modal de detalle quitando la clase que lo hace visible.
 */
function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('modal-visible');
    document.getElementById('modalDetalle').classList.remove('modal-visible');
}

// =====================================================================
// NUEVO PEDIDO
// =====================================================================

/*
 * abrirModalNuevoPedido()
 * ------------------------
 * Abre el modal para crear un nuevo pedido.
 * Genera una fila por cada producto del catálogo con controles de cantidad (+ / -).
 * El botón "Confirmar pedido" llama a enviarPedido().
 */
function abrirModalNuevoPedido() {
    // Construimos la lista de productos con sus controles de cantidad
    let html = '<div style="padding:0 20px">';
    if (productos.length === 0) {
        html += '<p style="color:#64748b;padding:20px 0">No hay productos disponibles.</p>';
    } else {
        productos.forEach(function(p) {
            html += `
            <div class="linea-producto" id="linea-${p.idProducto}">
                <div style="flex:1">
                    <p class="linea-nombre">${p.nombre}</p>
                    <p class="linea-precio">€ ${p.precio.toFixed(2)} c/u</p>
                </div>
                <div class="linea-cantidad">
                    <button class="btn-qty" onclick="cambiarCantidad(${p.idProducto}, -1, ${p.precio})">−</button>
                    <input class="input-qty" type="number" id="qty-${p.idProducto}" value="0" min="0" max="99"
                           oninput="recalcularTotal()">
                    <button class="btn-qty" onclick="cambiarCantidad(${p.idProducto}, +1, ${p.precio})">+</button>
                </div>
            </div>`;
        });
    }
    html += '</div>';
    document.getElementById('modalNuevoBody').innerHTML = html;
    document.getElementById('totalNuevoPedido').textContent = '€ 0.00';
    document.getElementById('modalNuevoOverlay').classList.add('modal-visible');
    document.getElementById('modalNuevoPedido').classList.add('modal-visible');
}

/*
 * cerrarModalNuevo()
 * -------------------
 * Cierra el modal de nuevo pedido.
 */
function cerrarModalNuevo() {
    document.getElementById('modalNuevoOverlay').classList.remove('modal-visible');
    document.getElementById('modalNuevoPedido').classList.remove('modal-visible');
}

/*
 * cambiarCantidad(idProducto, delta, precio)
 * -------------------------------------------
 * Incrementa o decrementa en 1 la cantidad del producto indicado
 * y recalcula el total del pedido.
 */
function cambiarCantidad(idProducto, delta) {
    var input = document.getElementById('qty-' + idProducto);
    var nuevo = Math.max(0, (parseInt(input.value) || 0) + delta);
    input.value = nuevo;
    recalcularTotal();
}

/*
 * recalcularTotal()
 * ------------------
 * Lee todas las cantidades del modal y recalcula el importe total.
 * Actualiza el texto del pie del modal.
 */
function recalcularTotal() {
    var total = 0;
    productos.forEach(function(p) {
        var input = document.getElementById('qty-' + p.idProducto);
        if (input) {
            var qty = parseInt(input.value) || 0;
            total += qty * p.precio;
        }
    });
    document.getElementById('totalNuevoPedido').textContent = '€ ' + total.toFixed(2);
}

/*
 * enviarPedido()
 * ---------------
 * Recoge las cantidades del modal, descarta los productos con cantidad 0,
 * y envía el pedido a la API con POST /api/pedidos.
 * Si todo va bien, cierra el modal y recarga la lista de pedidos.
 */
async function enviarPedido() {
    var idUsuario = parseInt(sessionStorage.getItem('usuario_id'));
    var lineas = [];

    // Recogemos solo los productos con cantidad > 0
    productos.forEach(function(p) {
        var input = document.getElementById('qty-' + p.idProducto);
        if (input) {
            var qty = parseInt(input.value) || 0;
            if (qty > 0) lineas.push({ idProducto: p.idProducto, cantidad: qty });
        }
    });

    if (lineas.length === 0) {
        alert('Añade al menos un producto al pedido.');
        return;
    }

    try {
        var response = await fetch(API_URL + '/api/pedidos', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ idUsuario: idUsuario, lineas: lineas })
        });

        if (response.ok) {
            var nuevo = await response.json();
            // Añadimos el nuevo pedido al array local para que aparezca sin recargar
            misPedidos.unshift({
                id:      nuevo.idPedido,
                fecha:   nuevo.fechaPedido,
                estado:  nuevo.estado,
                importe: nuevo.importeTotal
            });
            cerrarModalNuevo();
            renderStats();
            renderPedidos();
        } else {
            alert('Error al crear el pedido. Inténtalo de nuevo.');
        }
    } catch (e) {
        alert('No se pudo conectar con el servidor.');
    }
}
