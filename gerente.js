// gerente.js — Lógica del panel del gerente
// Autor: Carlos Ugarte Galán

// Dirección donde está escuchando la API Spring Boot
const API_URL = 'http://localhost:8085';

// =====================================================================
// DATOS — cargados desde la API al iniciar
// =====================================================================

// Arrays globales donde guardamos todos los datos del negocio
let productos    = []; // Catálogo de productos con stock
let trabajadores = []; // Lista de empleados
let tareasTodas  = []; // Todas las tareas asignadas al equipo
let pedidos      = []; // Historial de pedidos de todos los clientes
let todosUsuarios = []; // Todos los usuarios (gerentes, trabajadores y clientes)
                        // Lo usamos para cruzar pedidos con nombres de clientes

// ── Datos locales que no tienen tabla en la base de datos ──
// Actividad reciente del panel principal (se podría guardar en BD en el futuro)
const actividadReciente = [
    { icono:'fa-user-plus',   color:'verde',   texto:'Nuevo pedido registrado',              hora:'Hace 10 min'  },
    { icono:'fa-exclamation', color:'rojo',    texto:'Alerta de stock bajo detectada',       hora:'Hace 45 min'  },
    { icono:'fa-check',       color:'verde',   texto:'Tarea completada por el equipo',       hora:'Hace 1 hora'  },
    { icono:'fa-arrow-down',  color:'naranja', texto:'Producto por debajo del mínimo',       hora:'Hace 2 horas' },
    { icono:'fa-usuario',     color:'azul',    texto:'Trabajador ha fichado entrada',        hora:'Hace 3 horas' }
];

// Histórico de ingresos de los últimos 6 meses (para el gráfico de barras CSS)
const ingresosHistorico = [
    { mes:'Nov', valor:8200  }, { mes:'Dic', valor:11400 }, { mes:'Ene', valor:9700  },
    { mes:'Feb', valor:12100 }, { mes:'Mar', valor:10800 }, { mes:'Abr', valor:14350 }
];

// Notificaciones del panel (array de objetos con estado leída/no leída)
let notificaciones = [
    { leida:false, icono:'fa-exclamation-triangle', color:'rojo',    texto:'Alerta de stock en productos',               hora:'10:23' },
    { leida:false, icono:'fa-clock',                color:'naranja', texto:'Hay tareas sin actualizar hace tiempo',      hora:'09:45' },
    { leida:true,  icono:'fa-check-circle',         color:'verde',   texto:'Pedido entregado con éxito',                hora:'Ayer'  }
];

// Filtros activos para cada sección (se cambian con los botones de filtro)
let filtroStock  = 'todos';  // Filtro de la sección de stock
let filtroTareas = 'todas';  // Filtro de la sección de tareas

// =====================================================================
// INICIALIZACIÓN — Se ejecuta cuando la página termina de cargar
// =====================================================================

document.addEventListener('DOMContentLoaded', async function() {
    cargarSesion();               // Verificamos sesión y mostramos datos del usuario
    await cargarDatosIniciales(); // Cargamos todos los datos de la API
    actualizarBadgesNav();        // Actualizamos los números del sidebar
    renderDashboard();            // Pintamos el dashboard por defecto

    // Cerramos el panel de notificaciones si el usuario hace clic fuera de él
    document.addEventListener('click', function(e) {
        const wrapper = document.querySelector('.notif-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            document.getElementById('notifPanel').classList.remove('abierto');
        }
    });
});

/*
 * cargarDatosIniciales()
 * -----------------------
 * Carga todos los datos necesarios desde la API en paralelo usando Promise.all.
 * Esto es mucho más rápido que hacer las 5 peticiones una detrás de otra.
 *
 * Peticiones que hace:
 *   1. GET /api/productos         → catálogo de productos
 *   2. GET /api/usuarios/trabajadores → lista de empleados
 *   3. GET /api/tareas            → todas las tareas
 *   4. GET /api/pedidos           → todos los pedidos
 *   5. GET /api/usuarios          → todos los usuarios (para cruzar con pedidos)
 *
 * También transforma los nombres de campo de la API al formato interno del JS.
 */
async function cargarDatosIniciales() {
    try {
        // Todas las peticiones se hacen a la vez. Esperamos a que TODAS terminen.
        const [prods, trabList, tareas, peds, users] = await Promise.all([
            fetch(API_URL + '/api/productos').then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/usuarios/trabajadores').then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/tareas').then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/pedidos').then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/usuarios').then(function(r) { return r.json(); })
        ]);

        // Guardamos todos los usuarios para poder buscar el nombre del cliente en un pedido
        todosUsuarios = users;

        // Transformamos los productos al formato interno
        // La referencia (PROD-001) se genera aquí porque no existe en la BD
        productos = prods.map(function(p) {
            return {
                id:          p.idProducto,
                ref:         'PROD-' + String(p.idProducto).padStart(3, '0'), // Ej: PROD-001
                nombre:      p.nombre,
                descripcion: p.descripcion || '',
                proveedor:   p.proveedor   || '',
                precio:      p.precio,
                stockActual: p.stockActual,
                stockMinimo: p.stockMinimo
            };
        });

        // Transformamos los trabajadores
        // El turno no existe en la BD, se muestra como guion
        trabajadores = trabList.map(function(t) {
            return {
                id:     t.idUsuario,
                nombre: t.nombre,
                email:  t.email,
                turno:  '—',      // No hay campo turno en la BD todavía
                activo: t.activo  // true = puede loguearse, false = desactivado
            };
        });

        // Transformamos las tareas
        // La API usa 'fechaAsignacion' y nosotros lo guardamos como 'fecha'
        tareasTodas = tareas.map(function(t) {
            return {
                id:          t.idTarea,
                titulo:      t.titulo,
                descripcion: t.descripcion || '',
                fecha:       t.fechaAsignacion,
                estado:      t.estado,
                idUsuario:   t.idUsuario // A qué trabajador está asignada
            };
        });

        // Transformamos los pedidos y les añadimos el nombre del cliente
        // Para eso cruzamos cada pedido con el array de usuarios
        pedidos = peds.map(function(p) {
            const cliente = users.find(function(u) { return u.idUsuario === p.idUsuario; });
            return {
                id:           p.idPedido,
                fecha:        p.fechaPedido,
                estado:       p.estado,
                importe:      p.importeTotal,
                nombreCliente: cliente ? cliente.nombre : 'Cliente #' + p.idUsuario, // Fallback si no existe
                idUsuario:    p.idUsuario
            };
        });

    } catch (e) {
        // Si la API falla, avisamos con un alert para que el gerente sepa que hay un problema
        console.error('Error al cargar datos de la API:', e);
        alert('No se puede conectar con el servidor. ¿Está la API arrancada en el puerto 8085?');
    }
}

// =====================================================================
// GESTIÓN DE SESIÓN
// =====================================================================

/*
 * cargarSesion()
 * ---------------
 * Comprueba que hay sesión activa y rellena los datos del usuario
 * en el sidebar (nombre, email, iniciales del avatar).
 * Si no hay sesión, redirige al login.
 */
function cargarSesion() {
    const nombre = sessionStorage.getItem('usuario_nombre');
    const email  = sessionStorage.getItem('usuario_email');
    if (!nombre) { window.location.href = 'login.html'; return; }

    // Generamos las iniciales del nombre para el avatar circular
    // Ejemplo: "Carlos Ugarte" → "CU"
    const iniciales = nombre.split(' ').map(function(p) { return p[0]; }).join('').toUpperCase().slice(0, 2);

    // Rellenamos todos los elementos del DOM con los datos del usuario
    document.getElementById('sidebarNombre').textContent   = nombre;
    document.getElementById('sidebarEmail').textContent    = email || '';
    document.getElementById('avatarIniciales').textContent = iniciales;
    document.getElementById('topbarAvatar').textContent    = iniciales;
    document.getElementById('topbarNombre').textContent    = nombre;
}

/*
 * cerrarSesion()
 * ---------------
 * Limpia los datos de sesión y redirige al login.
 */
function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

// =====================================================================
// NAVEGACIÓN ENTRE SECCIONES (SPA - Single Page Application)
// =====================================================================

/*
 * navegarA(pagina, elemento)
 * ---------------------------
 * Simula la navegación entre páginas sin recargar el HTML.
 * Oculta todas las secciones y muestra solo la que se pide.
 * También actualiza el título, el subtítulo y el botón de acción.
 *
 * Parámetros:
 *   pagina   → nombre de la sección ('dashboard', 'stock', 'tareas', etc.)
 *   elemento → el elemento <a> del sidebar que se ha pulsado (para marcarlo como activo)
 */
function navegarA(pagina, elemento) {
    // Ocultamos todas las secciones (display: none)
    document.querySelectorAll('.page-section').forEach(function(s) { s.style.display = 'none'; });

    // Mostramos solo la sección solicitada
    document.getElementById('section-' + pagina).style.display = 'block';

    // Quitamos 'active' de todos los items del sidebar y lo ponemos en el que corresponde
    document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
    if (elemento) elemento.classList.add('active');

    // Actualizamos el título y subtítulo de la cabecera de contenido
    const titulos    = { dashboard:'Visión General', stock:'Gestión de Stock', tareas:'Tareas del Equipo', trabajadores:'Trabajadores', finanzas:'Información Financiera' };
    const subtitulos = { dashboard:'Resumen en tiempo real', stock:'Inventario y control de existencias', tareas:'Asignación y seguimiento de tareas', trabajadores:'Empleados y gestión de turnos', finanzas:'Ingresos, pedidos y facturación' };
    document.getElementById('pageTitulo').textContent    = titulos[pagina]    || '';
    document.getElementById('pageSubtitulo').textContent = subtitulos[pagina] || '';

    // El botón de acción principal solo aparece en secciones que tienen CRUD
    const btnAccion   = document.getElementById('btnAccionPrincipal');
    const textoAccion = { stock:'Nuevo Producto', tareas:'Nueva Tarea', trabajadores:'Nuevo Trabajador' };
    if (textoAccion[pagina]) {
        document.getElementById('textoAccion').textContent = textoAccion[pagina];
        btnAccion.style.display = 'flex'; // Mostramos el botón
    } else {
        btnAccion.style.display = 'none'; // Lo ocultamos si no tiene acción
    }

    // Renderizamos el contenido de la sección correspondiente
    if (pagina === 'dashboard')    renderDashboard();
    if (pagina === 'stock')        renderStock();
    if (pagina === 'tareas')       renderTareasEquipo();
    if (pagina === 'trabajadores') renderTrabajadores();
    if (pagina === 'finanzas')     renderFinanzas();

    // En móvil, cerramos el sidebar automáticamente al navegar
    if (window.innerWidth < 960) {
        document.getElementById('sidebar').classList.remove('sidebar-abierto');
    }
}

/*
 * accionPrincipal()
 * ------------------
 * Se llama al pulsar el botón "+ Nuevo..." del topbar.
 * Detecta qué sección está activa y abre el modal correspondiente.
 */
function accionPrincipal() {
    const seccion = document.querySelector('.page-section[style="display: block;"]');
    if (!seccion) return;
    const pagina = seccion.id.replace('section-', ''); // Extraemos el nombre de la sección del id
    if (pagina === 'stock')        abrirModalProducto(null);    // null = crear nuevo
    if (pagina === 'tareas')       abrirModalTarea(null);
    if (pagina === 'trabajadores') abrirModalTrabajador(null);
}

/*
 * toggleSidebar()
 * ----------------
 * Muestra u oculta el sidebar en dispositivos móviles.
 * La clase 'sidebar-abierto' se gestiona con CSS (transform).
 */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('sidebar-abierto');
}

// =====================================================================
// BADGES DEL SIDEBAR (números con alertas)
// =====================================================================

/*
 * actualizarBadgesNav()
 * ----------------------
 * Recalcula y actualiza los números en los badges del sidebar:
 *   - Badge de stock: cuántos productos tienen stock bajo o agotado
 *   - Badge de tareas: cuántas tareas están pendientes o en progreso
 *
 * Se llama cada vez que se modifican productos o tareas.
 */
function actualizarBadgesNav() {
    // Contamos productos con stock no óptimo (bajo o agotado)
    let alertasStock  = 0;
    productos.forEach(function(p) { if (estadoStock(p) !== 'optimo') alertasStock++; });

    // Contamos tareas que no están completadas (pendientes + en progreso)
    let tareasAbiertas = 0;
    tareasTodas.forEach(function(t) { if (t.estado !== 'COMPLETADA') tareasAbiertas++; });

    // Actualizamos los badges en el HTML
    document.getElementById('badgeStockNav').textContent  = alertasStock;
    document.getElementById('badgeTareasNav').textContent = tareasAbiertas;
}

/*
 * estadoStock(p)
 * ---------------
 * Función auxiliar que devuelve el estado de stock de un producto.
 * Usada en muchos sitios del código para no repetir la misma lógica.
 *
 * Devuelve:
 *   'agotado' → stockActual es 0
 *   'bajo'    → stockActual es menor que el stockMinimo
 *   'optimo'  → todo bien
 */
function estadoStock(p) {
    if (p.stockActual === 0)           return 'agotado';
    if (p.stockActual < p.stockMinimo) return 'bajo';
    return 'optimo';
}

// =====================================================================
// SECCIÓN DASHBOARD GENERAL
// =====================================================================

/*
 * renderDashboard()
 * ------------------
 * Pinta el dashboard principal con:
 *   - KPIs: tareas pendientes, alertas de stock y total de pedidos
 *   - Tabla de inventario crítico (productos con stock bajo o agotado)
 *   - Lista de actividad reciente
 *   - Panel de notificaciones
 *
 * También lanza la animación de contadores (los números "suben" desde 0).
 */
function renderDashboard() {
    // Calculamos los valores de los KPIs
    let nAlertas    = 0; productos.forEach(function(p)  { if (estadoStock(p) !== 'optimo') nAlertas++; });
    let nPendientes = 0; tareasTodas.forEach(function(t) { if (t.estado !== 'COMPLETADA')  nPendientes++; });

    // Actualizamos los data-valor de los KPIs (la animación los lee de aquí)
    document.getElementById('kpiTareasPend').dataset.valor = nPendientes;
    document.getElementById('kpiAlertas').dataset.valor    = nAlertas;
    document.getElementById('kpiPedidos').dataset.valor    = pedidos.length;

    // ── Tabla de inventario crítico ──
    // Filtramos solo los productos que necesitan atención
    const criticos = productos.filter(function(p) { return estadoStock(p) !== 'optimo'; });
    const tbody    = document.getElementById('tablaInventarioBody');

    if (criticos.length === 0) {
        // Si todo el stock está bien, mostramos un mensaje positivo
        tbody.innerHTML = '<tr><td colspan="5" class="tabla-vacia"><i class="fas fa-check-circle" style="color:#22c55e"></i> Todo el stock está en niveles correctos</td></tr>';
    } else {
        let filas = '';
        criticos.forEach(function(p) {
            const est   = estadoStock(p);
            const badge = est === 'agotado' ? 'badge-peligro' : 'badge-aviso';
            const texto = est === 'agotado' ? 'Agotado' : 'Bajo Stock';
            const color = est === 'agotado' ? '#ef4444' : '#f59e0b'; // Rojo o amarillo

            // Calculamos el porcentaje de la barra de stock
            // La barra llega al 100% cuando el stock es el doble del mínimo
            const pct = Math.min(100, Math.round((p.stockActual / (p.stockMinimo * 2)) * 100));

            filas += `<tr>
                <td><code>${p.ref}</code></td>
                <td>${p.nombre}</td>
                <td class="texto-gris">${p.proveedor}</td>
                <td>
                    <div class="stock-cell">
                        <span>${p.stockActual} uds.</span>
                        <div class="stock-bar"><div class="stock-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                    </div>
                </td>
                <td><span class="badge ${badge}">${texto}</span></td>
            </tr>`;
        });
        tbody.innerHTML = filas;
    }

    // ── Actividad reciente ──
    // Generamos la lista de eventos recientes desde el array local
    let actHTML = '';
    actividadReciente.forEach(function(ev) {
        actHTML += `<li class="actividad-item">
            <span class="actividad-icono act-${ev.color}"><i class="fas ${ev.icono}"></i></span>
            <div class="actividad-detalle"><p>${ev.texto}</p><span class="actividad-hora">${ev.hora}</span></div>
        </li>`;
    });
    document.getElementById('actividadLista').innerHTML = actHTML;

    renderNotificaciones(); // Pintamos el panel de notificaciones
    animarContadores();     // Lanzamos la animación de los números KPI
}

// =====================================================================
// SECCIÓN GESTIÓN DE STOCK
// =====================================================================

/*
 * renderStock()
 * --------------
 * Filtra el catálogo de productos según el buscador y el filtro de estado
 * y pinta la tabla de stock con todos los datos.
 *
 * Columnas que muestra: Referencia, Nombre, Proveedor, Precio,
 * Stock Actual (con barra), Stock Mínimo, Estado, Acciones (editar/eliminar).
 */
function renderStock() {
    // Texto de búsqueda (buscamos en nombre, referencia y proveedor)
    const busqueda = document.getElementById('busquedaStock').value.toLowerCase();

    // Aplicamos ambos filtros a la vez
    const filtrados = productos.filter(function(p) {
        const coincideTexto  = !busqueda ||
            p.nombre.toLowerCase().includes(busqueda) ||
            p.ref.toLowerCase().includes(busqueda) ||
            p.proveedor.toLowerCase().includes(busqueda);
        const coincideEstado = filtroStock === 'todos' || estadoStock(p) === filtroStock;
        return coincideTexto && coincideEstado;
    });

    // Mostramos cuántos productos hay tras el filtro
    document.getElementById('contadorProductos').textContent = filtrados.length + ' producto' + (filtrados.length !== 1 ? 's' : '');

    const tbody = document.getElementById('tablaStockBody');
    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="tabla-vacia">No se encontraron productos.</td></tr>';
        return;
    }

    // Generamos las filas de la tabla
    let filas = '';
    filtrados.forEach(function(p) {
        const est   = estadoStock(p);

        // Elegimos el badge, texto y color según el estado de stock
        const badge = est === 'agotado' ? 'badge-peligro' : est === 'bajo' ? 'badge-aviso' : 'badge-ok';
        const texto = est === 'agotado' ? 'Agotado' : est === 'bajo' ? 'Bajo Stock' : 'Óptimo';
        const color = est === 'agotado' ? '#ef4444' : est === 'bajo' ? '#f59e0b' : '#22c55e';

        // Porcentaje para la barra de progreso del stock
        const pct = Math.min(100, Math.round((p.stockActual / (p.stockMinimo * 2)) * 100));

        filas += `<tr>
            <td><code>${p.ref}</code></td>
            <td><strong>${p.nombre}</strong><br><small class="texto-gris">${p.descripcion}</small></td>
            <td>${p.proveedor}</td>
            <td><strong>€ ${p.precio.toFixed(2)}</strong></td>
            <td>
                <div class="stock-cell">
                    <span>${p.stockActual} uds.</span>
                    <div class="stock-bar"><div class="stock-bar-fill" style="width:${pct}%;background:${color}"></div></div>
                </div>
            </td>
            <td>${p.stockMinimo} uds.</td>
            <td><span class="badge ${badge}">${texto}</span></td>
            <td>
                <div class="acciones-celda">
                    <!-- Botón editar: pasa el id para que el modal sepa qué producto cargar -->
                    <button class="btn-accion-tabla btn-editar"   onclick="abrirModalProducto(${p.id})" title="Editar"><i class="fas fa-pen"></i></button>
                    <!-- Botón eliminar: pasa el id para confirmar el borrado -->
                    <button class="btn-accion-tabla btn-eliminar" onclick="confirmarEliminarProducto(${p.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
    tbody.innerHTML = filas;
}

/*
 * setFiltroStock(filtro, el)
 * ---------------------------
 * Cambia el filtro activo de la tabla de stock y la repinta.
 *
 * Parámetros:
 *   filtro → 'todos', 'bajo' o 'agotado'
 *   el     → el botón pulsado (para aplicarle la clase 'activo')
 */
function setFiltroStock(filtro, el) {
    filtroStock = filtro;
    document.querySelectorAll('#section-stock .filtro-btn').forEach(function(b) { b.classList.remove('activo'); });
    el.classList.add('activo');
    renderStock();
}

// ── CRUD de Productos ──

/*
 * abrirModalProducto(id)
 * -----------------------
 * Abre el modal de producto en modo "crear" o "editar" según si recibe un id.
 *
 * Parámetros:
 *   id → null para crear nuevo, número para editar el producto con ese id
 */
function abrirModalProducto(id) {
    // Limpiamos los mensajes de error del formulario antes de abrirlo
    ['errMpRef','errMpNombre','errMpPrecio','errMpStock'].forEach(function(idErr) {
        document.getElementById(idErr).textContent = '';
    });

    if (id === null) {
        // MODO CREAR: vaciamos todos los campos
        document.getElementById('modalProductoTitulo').textContent = 'Nuevo Producto';
        ['mpId','mpRef','mpNombre','mpDescripcion','mpProveedor','mpPrecio','mpStockActual','mpStockMinimo'].forEach(function(campo) {
            document.getElementById(campo).value = '';
        });
    } else {
        // MODO EDITAR: rellenamos los campos con los datos del producto seleccionado
        const p = productos.find(function(x) { return x.id === id; });
        document.getElementById('modalProductoTitulo').textContent = 'Editar Producto';
        document.getElementById('mpId').value          = p.id;
        document.getElementById('mpRef').value         = p.ref;
        document.getElementById('mpNombre').value      = p.nombre;
        document.getElementById('mpDescripcion').value = p.descripcion;
        document.getElementById('mpProveedor').value   = p.proveedor;
        document.getElementById('mpPrecio').value      = p.precio;
        document.getElementById('mpStockActual').value = p.stockActual;
        document.getElementById('mpStockMinimo').value = p.stockMinimo;
    }
    abrirModal('modalProducto'); // Hacemos visible el modal
}

/*
 * guardarProducto()
 * ------------------
 * Recoge los datos del modal de producto, los valida y los envía a la API.
 * Si hay id → PUT (editar producto existente)
 * Si no hay id → POST (crear producto nuevo)
 *
 * Después de guardar, recarga la lista completa desde la API para tener
 * los datos más actualizados.
 */
async function guardarProducto() {
    // Recogemos los valores del formulario
    const id          = parseInt(document.getElementById('mpId').value) || null;
    const nombre      = document.getElementById('mpNombre').value.trim();
    const precio      = parseFloat(document.getElementById('mpPrecio').value);
    const stockActual = parseInt(document.getElementById('mpStockActual').value);
    const stockMinimo = parseInt(document.getElementById('mpStockMinimo').value) || 0;

    // Validación: comprobamos que los campos obligatorios son correctos
    let valido = true;
    if (!nombre)         { document.getElementById('errMpNombre').textContent  = 'El nombre es obligatorio.';   valido = false; }
    if (isNaN(precio))   { document.getElementById('errMpPrecio').textContent  = 'Introduce un precio válido.'; valido = false; }
    if (isNaN(stockActual)) { document.getElementById('errMpStock').textContent = 'Introduce un stock válido.'; valido = false; }
    if (!valido) return; // Si hay errores, detenemos la función

    // Objeto con los datos a enviar a la API
    const datos = {
        nombre:      nombre,
        descripcion: document.getElementById('mpDescripcion').value.trim(),
        proveedor:   document.getElementById('mpProveedor').value.trim(),
        precio:      precio,
        stockActual: stockActual,
        stockMinimo: stockMinimo
    };

    try {
        let response;
        if (id) {
            // Editar producto existente: usamos PUT con el id en la URL
            response = await fetch(API_URL + '/api/productos/' + id, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
        } else {
            // Crear producto nuevo: usamos POST sin id en la URL
            response = await fetch(API_URL + '/api/productos', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
        }

        if (response.ok) {
            // Recargamos la lista completa desde la API para tener los datos frescos
            const prods = await fetch(API_URL + '/api/productos').then(function(r) { return r.json(); });
            productos = prods.map(function(p) {
                return { id: p.idProducto, ref: 'PROD-' + String(p.idProducto).padStart(3, '0'), nombre: p.nombre, descripcion: p.descripcion || '', proveedor: p.proveedor || '', precio: p.precio, stockActual: p.stockActual, stockMinimo: p.stockMinimo };
            });
            cerrarModales();        // Cerramos el modal
            renderStock();          // Actualizamos la tabla
            actualizarBadgesNav();  // Actualizamos los badges del sidebar
        }
    } catch (e) {
        console.error('Error al guardar producto:', e);
    }
}

/*
 * confirmarEliminarProducto(id)
 * ------------------------------
 * Muestra el modal de confirmación antes de eliminar un producto.
 * El modal pide al usuario que confirme la acción, porque no se puede deshacer.
 *
 * Parámetros:
 *   id → identificador del producto a eliminar
 */
function confirmarEliminarProducto(id) {
    const p = productos.find(function(x) { return x.id === id; });

    // Mostramos el nombre del producto en el mensaje de confirmación
    document.getElementById('confirmarMensaje').innerHTML = '¿Eliminar el producto <strong>' + p.nombre + '</strong>?<br>Esta acción no se puede deshacer.';

    // Asignamos la función de eliminar al botón de confirmación
    document.getElementById('btnConfirmarEliminar').onclick = function() { eliminarProducto(id); };

    abrirModal('modalConfirmar'); // Abrimos el modal de confirmación
}

/*
 * eliminarProducto(id)
 * ---------------------
 * Envía la petición DELETE a la API para borrar el producto.
 * Si tiene éxito, lo elimina también del array local y actualiza la tabla.
 *
 * Parámetros:
 *   id → identificador del producto a eliminar
 */
async function eliminarProducto(id) {
    try {
        const response = await fetch(API_URL + '/api/productos/' + id, { method: 'DELETE' });
        if (response.ok) {
            // Eliminamos el producto del array local (filter devuelve un nuevo array sin ese elemento)
            productos = productos.filter(function(p) { return p.id !== id; });
            cerrarModales();
            renderStock();
            actualizarBadgesNav();
        }
    } catch (e) {
        console.error('Error al eliminar producto:', e);
    }
}

// =====================================================================
// SECCIÓN TAREAS DEL EQUIPO
// =====================================================================

/*
 * renderTareasEquipo()
 * ---------------------
 * Pinta el grid de tarjetas kanban con las tareas del equipo.
 * Aplica el filtro activo (todas / pendiente / en progreso / completada).
 *
 * Cada tarjeta muestra:
 *   - Badge con el estado actual
 *   - Título y descripción de la tarea
 *   - Avatar con iniciales del trabajador asignado
 *   - Fecha de asignación
 *   - Select para cambiar el estado directamente
 *   - Botones de editar y eliminar
 */
function renderTareasEquipo() {
    // Aplicamos el filtro al array de tareas
    const lista = filtroTareas === 'todas'
        ? tareasTodas
        : tareasTodas.filter(function(t) { return t.estado === filtroTareas; });

    document.getElementById('contadorTareas').textContent = lista.length + ' tarea' + (lista.length !== 1 ? 's' : '');

    const grid = document.getElementById('tareasEquipoGrid');
    if (lista.length === 0) {
        grid.innerHTML = '<div class="tabla-vacia" style="grid-column:1/-1;padding:40px;text-align:center">No hay tareas con el filtro seleccionado.</div>';
        return;
    }

    let html = '';
    lista.forEach(function(tarea) {
        let badgeClase, badgeTexto, badgeIcono;

        // Determinamos el badge según el estado de la tarea
        if (tarea.estado === 'PENDIENTE')        { badgeClase = 'badge-aviso'; badgeTexto = 'Pendiente';   badgeIcono = 'fa-circle'; }
        else if (tarea.estado === 'EN_PROGRESO') { badgeClase = 'badge-info';  badgeTexto = 'En Progreso'; badgeIcono = 'fa-circle-half-stroke'; }
        else                                     { badgeClase = 'badge-ok';    badgeTexto = 'Completada';  badgeIcono = 'fa-circle-check'; }

        // Buscamos el trabajador asignado para mostrar su nombre e iniciales
        const trabajador = trabajadores.find(function(t) { return t.id === tarea.idUsuario; });
        const nombreTrab = trabajador ? trabajador.nombre : 'Sin asignar';

        // Generamos las iniciales del avatar (máximo 2 letras)
        const iniciales  = trabajador
            ? trabajador.nombre.split(' ').map(function(p) { return p[0]; }).join('').toUpperCase().slice(0, 2)
            : '?';

        html += `
        <div class="tarea-card">
            <div class="tarea-card-header">
                <span class="badge ${badgeClase}"><i class="fas ${badgeIcono}"></i> ${badgeTexto}</span>
                <div class="tarea-card-acciones">
                    <!-- Botón editar: pasa el id para cargar los datos en el modal -->
                    <button class="btn-accion-tabla btn-editar"   onclick="abrirModalTarea(${tarea.id})" title="Editar"><i class="fas fa-pen"></i></button>
                    <!-- Botón eliminar: pasa el id al modal de confirmación -->
                    <button class="btn-accion-tabla btn-eliminar" onclick="confirmarEliminarTarea(${tarea.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            <p class="tarea-card-titulo">${tarea.titulo}</p>
            <p class="tarea-card-desc">${tarea.descripcion}</p>
            <div class="tarea-card-footer">
                <div class="tarea-card-trabajador">
                    <div class="avatar-mini">${iniciales}</div>
                    <span>${nombreTrab}</span>
                </div>
                <span class="tarea-card-fecha"><i class="fas fa-calendar-alt"></i> ${tarea.fecha}</span>
            </div>
            <!-- Select para cambiar el estado directamente desde la tarjeta -->
            <select class="tarea-estado-select" onchange="cambiarEstadoTarea(${tarea.id}, this.value)">
                <option value="PENDIENTE"   ${tarea.estado === 'PENDIENTE'   ? 'selected' : ''}>Pendiente</option>
                <option value="EN_PROGRESO" ${tarea.estado === 'EN_PROGRESO' ? 'selected' : ''}>En Progreso</option>
                <option value="COMPLETADA"  ${tarea.estado === 'COMPLETADA'  ? 'selected' : ''}>Completada</option>
            </select>
        </div>`;
    });
    grid.innerHTML = html;
}

/*
 * cambiarEstadoTarea(id, nuevoEstado)
 * ------------------------------------
 * Cambia el estado de una tarea desde el select de la tarjeta.
 * Envía PUT a la API para persistir el cambio.
 * Si la API lo confirma, actualiza el array local y refresca la vista.
 *
 * Parámetros:
 *   id          → id de la tarea a modificar
 *   nuevoEstado → el nuevo estado seleccionado ('PENDIENTE', 'EN_PROGRESO' o 'COMPLETADA')
 */
async function cambiarEstadoTarea(id, nuevoEstado) {
    try {
        const response = await fetch(API_URL + '/api/tareas/' + id + '/estado', {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ estado: nuevoEstado })
        });
        if (response.ok) {
            // Actualizamos el estado en el array local
            const tarea = tareasTodas.find(function(t) { return t.id === id; });
            if (tarea) tarea.estado = nuevoEstado;

            actualizarBadgesNav();  // Los badges del sidebar cambian
            renderTareasEquipo();   // Repintamos las tarjetas
        }
    } catch (e) {
        console.error('Error al cambiar estado:', e);
    }
}

/*
 * setFiltroTareas(filtro, el)
 * ----------------------------
 * Cambia el filtro activo de la sección de tareas y las repinta.
 *
 * Parámetros:
 *   filtro → 'todas', 'PENDIENTE', 'EN_PROGRESO' o 'COMPLETADA'
 *   el     → el botón pulsado (para ponerle la clase 'activo')
 */
function setFiltroTareas(filtro, el) {
    filtroTareas = filtro;
    document.querySelectorAll('#section-tareas .filtro-btn').forEach(function(b) { b.classList.remove('activo'); });
    el.classList.add('activo');
    renderTareasEquipo();
}

// ── CRUD de Tareas ──

/*
 * abrirModalTarea(id)
 * --------------------
 * Abre el modal de tarea en modo "crear" o "editar".
 * Rellena el select de trabajadores con los empleados activos.
 *
 * Parámetros:
 *   id → null para crear nueva tarea, número para editar la tarea con ese id
 */
function abrirModalTarea(id) {
    // Limpiamos errores del formulario
    ['errMtTitulo','errMtTrabajador'].forEach(function(idErr) { document.getElementById(idErr).textContent = ''; });

    // Rellenamos el select de trabajadores (solo los activos)
    const selectTrab = document.getElementById('mtTrabajador');
    let opcionesTrab = '';
    trabajadores.filter(function(t) { return t.activo; }).forEach(function(t) {
        opcionesTrab += '<option value="' + t.id + '">' + t.nombre + '</option>';
    });
    selectTrab.innerHTML = opcionesTrab;

    if (id === null) {
        // MODO CREAR: limpiamos campos y ponemos valores por defecto
        document.getElementById('modalTareaTitulo').textContent = 'Nueva Tarea';
        ['mtId','mtTitulo','mtDescripcion'].forEach(function(campo) { document.getElementById(campo).value = ''; });
        document.getElementById('mtEstado').value = 'PENDIENTE';
        document.getElementById('mtFecha').value  = new Date().toISOString().slice(0, 10); // Fecha de hoy en YYYY-MM-DD
    } else {
        // MODO EDITAR: rellenamos con los datos de la tarea seleccionada
        const tarea = tareasTodas.find(function(t) { return t.id === id; });
        document.getElementById('modalTareaTitulo').textContent = 'Editar Tarea';
        document.getElementById('mtId').value          = tarea.id;
        document.getElementById('mtTitulo').value      = tarea.titulo;
        document.getElementById('mtDescripcion').value = tarea.descripcion;
        document.getElementById('mtEstado').value      = tarea.estado;
        document.getElementById('mtTrabajador').value  = tarea.idUsuario;

        // Convertimos la fecha de DD/MM/YYYY a YYYY-MM-DD para el input type="date"
        const partes = tarea.fecha.split('/');
        document.getElementById('mtFecha').value = partes[2] + '-' + partes[1] + '-' + partes[0];
    }
    abrirModal('modalTareaEquipo');
}

/*
 * guardarTareaEquipo()
 * ---------------------
 * Recoge los datos del modal de tarea, los valida y los envía a la API.
 * Si hay id → PUT (editar tarea existente)
 * Si no hay id → POST (crear tarea nueva)
 *
 * Convierte la fecha del formato YYYY-MM-DD (input HTML) a DD/MM/YYYY (lo que usa la API).
 */
async function guardarTareaEquipo() {
    // Recogemos los valores del formulario
    const id        = parseInt(document.getElementById('mtId').value) || null;
    const titulo    = document.getElementById('mtTitulo').value.trim();
    const idUsuario = parseInt(document.getElementById('mtTrabajador').value);

    // Validación básica
    let valido = true;
    if (!titulo)    { document.getElementById('errMtTitulo').textContent     = 'El título es obligatorio.'; valido = false; }
    if (!idUsuario) { document.getElementById('errMtTrabajador').textContent = 'Selecciona un trabajador.'; valido = false; }
    if (!valido) return;

    // Convertimos la fecha de YYYY-MM-DD a DD/MM/YYYY
    const partes = document.getElementById('mtFecha').value.split('-');
    const fecha  = partes[2] + '/' + partes[1] + '/' + partes[0];

    const datos = {
        titulo:          titulo,
        descripcion:     document.getElementById('mtDescripcion').value.trim() || '',
        fechaAsignacion: fecha,
        estado:          document.getElementById('mtEstado').value,
        idUsuario:       idUsuario
    };

    try {
        let response;
        if (id) {
            // Editar tarea completa con PUT
            response = await fetch(API_URL + '/api/tareas/' + id, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
            if (response.ok) {
                // Actualizamos la tarea en el array local
                const t = tareasTodas.find(function(t) { return t.id === id; });
                if (t) { t.titulo = datos.titulo; t.descripcion = datos.descripcion; t.estado = datos.estado; t.idUsuario = datos.idUsuario; t.fecha = fecha; }
            }
        } else {
            // Crear tarea nueva con POST
            response = await fetch(API_URL + '/api/tareas', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
            if (response.ok) {
                // La API nos devuelve la tarea creada con su id → la añadimos al array local
                const nueva = await response.json();
                tareasTodas.push({ id: nueva.idTarea, titulo: nueva.titulo, descripcion: nueva.descripcion, fecha: nueva.fechaAsignacion, estado: nueva.estado, idUsuario: nueva.idUsuario });
            }
        }
        cerrarModales();
        renderTareasEquipo();
        actualizarBadgesNav();
    } catch (e) {
        console.error('Error al guardar tarea:', e);
    }
}

/*
 * confirmarEliminarTarea(id)
 * ---------------------------
 * Muestra el modal de confirmación antes de eliminar una tarea.
 *
 * Parámetros:
 *   id → identificador de la tarea a eliminar
 */
function confirmarEliminarTarea(id) {
    const tarea = tareasTodas.find(function(t) { return t.id === id; });
    document.getElementById('confirmarMensaje').innerHTML = '¿Eliminar la tarea <strong>"' + tarea.titulo + '"</strong>?<br>Esta acción no se puede deshacer.';
    document.getElementById('btnConfirmarEliminar').onclick = function() { eliminarTarea(id); };
    abrirModal('modalConfirmar');
}

/*
 * eliminarTarea(id)
 * ------------------
 * Envía DELETE a la API y, si tiene éxito, elimina la tarea del array local.
 *
 * Parámetros:
 *   id → identificador de la tarea a eliminar
 */
async function eliminarTarea(id) {
    try {
        const response = await fetch(API_URL + '/api/tareas/' + id, { method: 'DELETE' });
        if (response.ok) {
            tareasTodas = tareasTodas.filter(function(t) { return t.id !== id; });
            cerrarModales();
            renderTareasEquipo();
            actualizarBadgesNav();
        }
    } catch (e) {
        console.error('Error al eliminar tarea:', e);
    }
}

// =====================================================================
// SECCIÓN TRABAJADORES
// =====================================================================

/*
 * renderTrabajadores()
 * ---------------------
 * Genera el grid de tarjetas de empleados.
 * Cada tarjeta muestra:
 *   - Avatar con iniciales
 *   - Nombre, email
 *   - Número de tareas activas (pendientes o en progreso)
 *   - Badge de activo/inactivo
 *   - Botones de editar y eliminar
 *
 * Los trabajadores inactivos aparecen con menos opacidad.
 */
function renderTrabajadores() {
    let html = '';
    trabajadores.forEach(function(t) {
        // Contamos las tareas activas (no completadas) de este trabajador
        let tareasActivas = 0;
        tareasTodas.forEach(function(ta) { if (ta.idUsuario === t.id && ta.estado !== 'COMPLETADA') tareasActivas++; });

        // Generamos las iniciales del nombre
        const iniciales = t.nombre.split(' ').map(function(p) { return p[0]; }).join('').toUpperCase().slice(0, 2);

        html += `
        <div class="trabajador-card ${t.activo ? '' : 'trabajador-inactivo'}">
            <div class="trabajador-avatar">${iniciales}</div>
            <div class="trabajador-info">
                <h4>${t.nombre}</h4>
                <p class="trabajador-email"><i class="fas fa-envelope"></i> ${t.email}</p>
                <div class="trabajador-meta">
                    <span><i class="fas fa-tasks"></i> ${tareasActivas} tarea${tareasActivas !== 1 ? 's' : ''} activa${tareasActivas !== 1 ? 's' : ''}</span>
                </div>
            </div>
            <div class="trabajador-acciones">
                <!-- Badge de estado: verde si activo, gris si inactivo -->
                <span class="badge ${t.activo ? 'badge-ok' : 'badge-inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span>
                <div style="display:flex;gap:6px;margin-top:10px">
                    <button class="btn-accion-tabla btn-editar"   onclick="abrirModalTrabajador(${t.id})" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="btn-accion-tabla btn-eliminar" onclick="confirmarEliminarTrabajador(${t.id})" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    });
    document.getElementById('trabajadoresGrid').innerHTML = html;
}

/*
 * abrirModalTrabajador(id)
 * -------------------------
 * Abre el modal de trabajador en modo "crear" o "editar".
 *
 * Parámetros:
 *   id → null para crear nuevo, número para editar el trabajador con ese id
 */
function abrirModalTrabajador(id) {
    // Limpiamos errores del formulario
    ['errMtrNombre','errMtrEmail','errMtrPassword'].forEach(function(idErr) { document.getElementById(idErr).textContent = ''; });

    if (id === null) {
        // MODO CREAR: limpiamos todos los campos
        document.getElementById('modalTrabajadorTitulo').textContent = 'Nuevo Trabajador';
        ['mtrId','mtrNombre','mtrEmail','mtrPassword'].forEach(function(campo) { document.getElementById(campo).value = ''; });
        document.getElementById('mtrActivo').value = 'true'; // Por defecto activo
    } else {
        // MODO EDITAR: rellenamos con los datos del trabajador
        const t = trabajadores.find(function(x) { return x.id === id; });
        document.getElementById('modalTrabajadorTitulo').textContent = 'Editar Trabajador';
        document.getElementById('mtrId').value     = t.id;
        document.getElementById('mtrNombre').value = t.nombre;
        document.getElementById('mtrEmail').value  = t.email;
        document.getElementById('mtrActivo').value = String(t.activo); // true/false como string para el select
        document.getElementById('mtrPassword').value = ''; // La contraseña no se muestra por seguridad
    }
    abrirModal('modalTrabajador');
}

/*
 * guardarTrabajador()
 * --------------------
 * Recoge los datos del modal de trabajador, los valida y los envía a la API.
 * Si hay id → PUT (editar trabajador)
 * Si no hay id → POST (crear trabajador nuevo)
 *
 * El rol se fija siempre como 'TRABAJADOR' ya que el gerente no puede cambiar roles.
 */
async function guardarTrabajador() {
    // Recogemos los valores del formulario
    const id       = parseInt(document.getElementById('mtrId').value) || null;
    const nombre   = document.getElementById('mtrNombre').value.trim();
    const email    = document.getElementById('mtrEmail').value.trim();
    const password = document.getElementById('mtrPassword').value;

    // Validación de los campos obligatorios
    let valido = true;
    if (!nombre)                        { document.getElementById('errMtrNombre').textContent   = 'El nombre es obligatorio.';  valido = false; }
    if (!email || !email.includes('@')) { document.getElementById('errMtrEmail').textContent    = 'Introduce un email válido.'; valido = false; }
    if (!id && password.length < 4)     { document.getElementById('errMtrPassword').textContent = 'Mínimo 4 caracteres.';      valido = false; }
    if (!valido) return;

    const datos = {
        nombre:   nombre,
        email:    email,
        password: password,
        rol:      'TRABAJADOR', // Siempre TRABAJADOR, el gerente no puede crear otros gerentes desde aquí
        activo:   document.getElementById('mtrActivo').value === 'true' // Convertimos string a booleano
    };

    try {
        let response;
        if (id) {
            // Editar trabajador existente con PUT
            response = await fetch(API_URL + '/api/usuarios/' + id, {
                method:  'PUT',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
        } else {
            // Crear trabajador nuevo con POST
            response = await fetch(API_URL + '/api/usuarios', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify(datos)
            });
        }

        if (response.ok) {
            // Recargamos la lista de trabajadores desde la API para tener los datos frescos
            const trabList = await fetch(API_URL + '/api/usuarios/trabajadores').then(function(r) { return r.json(); });
            trabajadores = trabList.map(function(t) {
                return { id: t.idUsuario, nombre: t.nombre, email: t.email, turno: '—', activo: t.activo };
            });
            cerrarModales();
            renderTrabajadores();
        }
    } catch (e) {
        console.error('Error al guardar trabajador:', e);
    }
}

/*
 * confirmarEliminarTrabajador(id)
 * --------------------------------
 * Muestra el modal de confirmación antes de eliminar un trabajador.
 * Avisa de que sus tareas quedarán sin responsable.
 *
 * Parámetros:
 *   id → identificador del trabajador a eliminar
 */
function confirmarEliminarTrabajador(id) {
    const t = trabajadores.find(function(x) { return x.id === id; });
    document.getElementById('confirmarMensaje').innerHTML = '¿Eliminar al trabajador <strong>' + t.nombre + '</strong>?<br>Sus tareas asignadas quedarán sin responsable.';
    document.getElementById('btnConfirmarEliminar').onclick = function() { eliminarTrabajador(id); };
    abrirModal('modalConfirmar');
}

/*
 * eliminarTrabajador(id)
 * -----------------------
 * Envía DELETE a la API y elimina el trabajador del array local.
 *
 * Parámetros:
 *   id → identificador del trabajador a eliminar
 */
async function eliminarTrabajador(id) {
    try {
        const response = await fetch(API_URL + '/api/usuarios/' + id, { method: 'DELETE' });
        if (response.ok) {
            trabajadores = trabajadores.filter(function(t) { return t.id !== id; });
            cerrarModales();
            renderTrabajadores();
        }
    } catch (e) {
        console.error('Error al eliminar trabajador:', e);
    }
}

// =====================================================================
// SECCIÓN INFORMACIÓN FINANCIERA
// =====================================================================

/*
 * renderFinanzas()
 * -----------------
 * Pinta la sección de finanzas con:
 *   - 4 KPIs: ingresos totales, nº pedidos, ticket medio, pedidos cancelados
 *   - Tabla con el historial completo de pedidos
 *   - Gráfico de barras CSS con los ingresos de los últimos 6 meses
 *
 * Los ingresos totales solo cuentan los pedidos ENTREGADOS
 * (los EN_PROCESO aún no han generado ingreso confirmado).
 */
function renderFinanzas() {
    // Calculamos los KPIs financieros
    let totalIngresos = 0, nEntregados = 0, nCancelados = 0;
    pedidos.forEach(function(p) {
        if (p.estado === 'ENTREGADO') { totalIngresos += p.importe; nEntregados++; }
        if (p.estado === 'CANCELADO') nCancelados++;
    });

    // Ticket medio = ingresos totales / número de pedidos entregados
    const ticketMedio = nEntregados > 0 ? totalIngresos / nEntregados : 0;

    // Actualizamos los KPIs en el HTML
    document.getElementById('finIngresosTotal').textContent = '€ ' + totalIngresos.toLocaleString('es-ES', { minimumFractionDigits: 2 });
    document.getElementById('finNPedidos').textContent      = pedidos.length;
    document.getElementById('finTicketMedio').textContent   = '€ ' + ticketMedio.toFixed(2);
    document.getElementById('finCancelados').textContent    = nCancelados;

    // ── Tabla de pedidos ──
    let filas = '';
    pedidos.forEach(function(p) {
        let badgeClase, badgeTexto;
        if (p.estado === 'EN_PROCESO')      { badgeClase = 'badge-info';    badgeTexto = 'En Proceso'; }
        else if (p.estado === 'ENTREGADO')  { badgeClase = 'badge-ok';      badgeTexto = 'Entregado';  }
        else                                { badgeClase = 'badge-peligro'; badgeTexto = 'Cancelado';  }

        filas += `<tr>
            <td><code>#${p.id}</code></td>
            <td>${p.fecha}</td>
            <td>${p.nombreCliente}</td>
            <td><strong>€ ${p.importe.toFixed(2)}</strong></td>
            <td><span class="badge ${badgeClase}">${badgeTexto}</span></td>
            <!-- Botón para ver el detalle del pedido (líneas de producto) -->
            <td><button class="btn-ver-todo" onclick="verDetallePedido(${p.id})">Ver líneas <i class="fas fa-arrow-right"></i></button></td>
        </tr>`;
    });
    document.getElementById('tablaPedidosBody').innerHTML = filas;

    // ── Gráfico de barras CSS ──
    // Calculamos la altura de cada barra como porcentaje del valor máximo
    const maxValor = Math.max.apply(null, ingresosHistorico.map(function(d) { return d.valor; }));
    let barrasHTML = '<div class="barras-container">';
    ingresosHistorico.forEach(function(d) {
        const pct      = Math.round((d.valor / maxValor) * 100); // Porcentaje respecto al máximo
        const esActual = d.mes === 'Abr';   // El mes actual se pinta en verde destacado
        barrasHTML += `
            <div class="barra-item">
                <div class="barra-valor">€${(d.valor / 1000).toFixed(1)}k</div>
                <div class="barra-wrap"><div class="barra-fill ${esActual ? 'barra-activa' : ''}" style="height:${pct}%"></div></div>
                <div class="barra-mes">${d.mes}</div>
            </div>`;
    });
    barrasHTML += '</div><p style="text-align:center;font-size:0.72rem;color:#94a3b8;margin-top:8px">Últimos 6 meses (€)</p>';
    document.getElementById('graficoBars').innerHTML = barrasHTML;
}

/*
 * verDetallePedido(id)
 * ---------------------
 * Abre el modal con las líneas de un pedido concreto.
 * Carga las líneas desde la API y las cruza con el catálogo de productos
 * para obtener el nombre y precio de cada producto.
 *
 * Pasos:
 *   1. Muestra el modal con "Cargando..." mientras espera la API
 *   2. Pide las líneas del pedido (id_producto + cantidad)
 *   3. Cruza con el array 'productos' para obtener nombre y precio
 *   4. Genera la tabla con los datos
 *
 * Parámetros:
 *   id → identificador del pedido a ver
 */
async function verDetallePedido(id) {
    const pedido = pedidos.find(function(p) { return p.id === id; });

    // Preparamos el badge de estado para mostrar en el modal
    let badgeClase, badgeTexto;
    if (pedido.estado === 'EN_PROCESO')      { badgeClase = 'badge-info';    badgeTexto = 'En Proceso'; }
    else if (pedido.estado === 'ENTREGADO')  { badgeClase = 'badge-ok';      badgeTexto = 'Entregado';  }
    else                                     { badgeClase = 'badge-peligro'; badgeTexto = 'Cancelado';  }

    // Mostramos el título y el mensaje de carga
    document.getElementById('modalPedidoTitulo').textContent = 'Pedido #' + pedido.id + ' — ' + pedido.fecha;
    document.getElementById('modalPedidoBody').innerHTML = '<p style="padding:20px;color:#64748b">Cargando líneas...</p>';
    abrirModal('modalPedido');

    try {
        // Pedimos las líneas del pedido a la API
        const lineasAPI = await fetch(API_URL + '/api/pedidos/' + id + '/productos').then(function(r) { return r.json(); });

        // Generamos las filas cruzando con el catálogo de productos
        let filas = '';
        lineasAPI.forEach(function(l) {
            const prod    = productos.find(function(x) { return x.id === l.id.idProducto; });
            const nombre  = prod ? prod.nombre : 'Producto #' + l.id.idProducto;
            const precio  = prod ? prod.precio : 0;
            filas += `<tr>
                <td>${nombre}</td>
                <td>${l.cantidad} uds.</td>
                <td>€ ${precio.toFixed(2)}</td>
                <td><strong>€ ${(l.cantidad * precio).toFixed(2)}</strong></td>
            </tr>`;
        });

        // Pintamos el contenido del modal con la tabla completa
        document.getElementById('modalPedidoBody').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <p style="font-size:0.82rem;color:#64748b">Cliente: <strong>${pedido.nombreCliente}</strong> · Estado: <span class="badge ${badgeClase}">${badgeTexto}</span></p>
            </div>
            <table>
                <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
                <tbody>${filas}</tbody>
                <tfoot>
                    <tr style="border-top:2px solid #e2e8f0">
                        <td colspan="3" style="text-align:right;font-weight:700;padding:12px 16px">TOTAL</td>
                        <td style="font-weight:800;font-size:1rem;padding:12px 16px">€ ${pedido.importe.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>`;
    } catch (e) {
        document.getElementById('modalPedidoBody').innerHTML = '<p style="color:#ef4444;padding:20px">Error al cargar las líneas del pedido.</p>';
    }
}

// =====================================================================
// SISTEMA DE NOTIFICACIONES
// =====================================================================

/*
 * renderNotificaciones()
 * -----------------------
 * Pinta el panel de notificaciones y actualiza el punto rojo de la campana.
 * Las notificaciones no leídas tienen fondo verde claro.
 * Al pulsar una notificación, se marca como leída.
 */
function renderNotificaciones() {
    // Contamos las no leídas para saber si mostrar el punto rojo
    let sinLeer = 0;
    notificaciones.forEach(function(n) { if (!n.leida) sinLeer++; });

    // Mostramos u ocultamos el punto rojo según haya no leídas
    document.getElementById('notifDot').style.display = sinLeer > 0 ? 'block' : 'none';

    // Generamos el HTML de cada notificación
    let html = '';
    notificaciones.forEach(function(n, i) {
        html += `<div class="notif-item ${n.leida ? '' : 'notif-no-leida'}" onclick="leerNotificacion(${i})">
            <span class="notif-icono act-${n.color}"><i class="fas ${n.icono}"></i></span>
            <div class="notif-detalle"><p>${n.texto}</p><span>${n.hora}</span></div>
        </div>`;
    });
    document.getElementById('notifLista').innerHTML = html;
}

/*
 * toggleNotificaciones()
 * -----------------------
 * Abre o cierra el panel de notificaciones al pulsar la campana.
 * Usa la clase 'abierto' para mostrar/ocultar con transición CSS.
 */
function toggleNotificaciones() {
    document.getElementById('notifPanel').classList.toggle('abierto');
}

/*
 * leerNotificacion(indice)
 * -------------------------
 * Marca como leída la notificación en la posición indicada del array.
 * Repinta el panel para reflejar el cambio.
 *
 * Parámetros:
 *   indice → posición de la notificación en el array notificaciones[]
 */
function leerNotificacion(indice) {
    notificaciones[indice].leida = true;
    renderNotificaciones();
}

/*
 * marcarTodoLeido()
 * ------------------
 * Marca todas las notificaciones como leídas de una vez.
 * Útil para limpiar todas las alertas rápidamente.
 */
function marcarTodoLeido() {
    notificaciones.forEach(function(n) { n.leida = true; });
    renderNotificaciones();
}

// =====================================================================
// BÚSQUEDA GLOBAL
// =====================================================================

/*
 * busquedaGlobal(query)
 * ----------------------
 * Busca en productos según el texto del buscador del topbar.
 * Si encuentra coincidencias, navega automáticamente a la sección de stock
 * y aplica el texto como filtro de búsqueda.
 *
 * Solo busca si hay al menos 2 caracteres (evita búsquedas vacías).
 *
 * Parámetros:
 *   query → texto introducido en el buscador del topbar
 */
function busquedaGlobal(query) {
    if (!query || query.length < 2) return; // Mínimo 2 caracteres para buscar

    const texto        = query.toLowerCase();
    const hayProductos = productos.some(function(p) {
        return p.nombre.toLowerCase().includes(texto) || p.ref.toLowerCase().includes(texto);
    });

    if (hayProductos) {
        // Si encontramos productos, navegamos a la sección de stock y aplicamos el filtro
        navegarA('stock', document.querySelector('[data-pagina=stock]'));
        document.getElementById('busquedaStock').value = query;
        renderStock(); // Renderizamos con el texto como filtro
    }
}

// =====================================================================
// GESTIÓN DE MODALES
// =====================================================================

/*
 * abrirModal(idModal)
 * --------------------
 * Muestra el overlay oscuro y el modal indicado.
 * Añade la clase 'modal-visible' que activa las transiciones CSS.
 *
 * Parámetros:
 *   idModal → id del modal a abrir (ej: 'modalProducto', 'modalConfirmar')
 */
function abrirModal(idModal) {
    document.getElementById('modalOverlay').classList.add('modal-visible');
    document.getElementById(idModal).classList.add('modal-visible');
}

/*
 * cerrarModales()
 * ----------------
 * Cierra TODOS los modales y el overlay de una vez.
 * Se llama al cancelar o al guardar con éxito.
 */
function cerrarModales() {
    document.querySelectorAll('.modal').forEach(function(m) { m.classList.remove('modal-visible'); });
    document.getElementById('modalOverlay').classList.remove('modal-visible');
}

// =====================================================================
// ANIMACIÓN COUNTUP (números que suben desde 0 en los KPIs)
// =====================================================================

/*
 * animarContadores()
 * -------------------
 * Anima los valores numéricos de los KPIs del dashboard.
 * Los números empiezan en 0 y "suben" hasta el valor real en 60 pasos
 * usando una función de suavizado (easing) cúbica para que la animación
 * sea fluida y acelere al principio y frene al final.
 *
 * Busca todos los elementos con clase 'kpi-valor' que tengan 'data-valor'.
 */
function animarContadores() {
    document.querySelectorAll('.kpi-valor[data-valor]').forEach(function(el) {
        const fin   = parseInt(el.dataset.valor) || 0; // Valor final al que llegar
        const pref  = el.dataset.prefijo || '';         // Prefijo opcional (ej: "€ ")
        const pasos = 60;  // Número de pasos de la animación
        let   paso  = 0;   // Paso actual (empieza en 0)

        // setInterval ejecuta la función 60 veces por segundo (1000/60 ≈ 16ms por paso)
        const inter = setInterval(function() {
            paso++;
            const progreso = paso / pasos;         // Va de 0 a 1
            const eased    = 1 - Math.pow(1 - progreso, 3); // Función cubic ease-out
            const val      = Math.round(fin * eased);        // Valor actual de la animación

            // Usamos toLocaleString para números grandes (ej: 14.350 en vez de 14350)
            el.textContent = pref + (fin > 999 ? val.toLocaleString('es-ES') : val);

            if (paso >= pasos) {
                // Fin de la animación: ponemos el valor exacto y paramos el intervalo
                clearInterval(inter);
                el.textContent = pref + (fin > 999 ? fin.toLocaleString('es-ES') : fin);
            }
        }, 1000 / pasos); // ~16ms entre pasos para 60fps
    });
}
