// trabajador.js — Lógica del panel del trabajador
// Autor: Carlos Ugarte Galán

// Dirección donde está escuchando la API Spring Boot
const API_URL = 'http://localhost:8085';

// Arrays donde guardamos los datos que vendrán de la API
let tareas   = []; // Lista de tareas asignadas a este trabajador
let catalogo = []; // Lista de todos los productos (para el buscador de stock)

// Objeto que controla el estado del fichaje del trabajador
// Lo usamos para saber si está fichado y a qué hora entró
const fichaje = {
    activo:      false, // true = está trabajando, false = no ha fichado o ya salió
    horaEntrada: null,  // objeto Date con la hora de entrada (null si no ha fichado)
    registros:   []     // array con todos los fichajes del día (entradas y salidas)
};

// =====================================================================
// INICIALIZACIÓN — Se ejecuta cuando la página termina de cargar
// =====================================================================

// Esperamos a que el DOM esté listo para empezar a trabajar con él
document.addEventListener('DOMContentLoaded', async function() {
    cargarSesion();          // Verificamos que el usuario está logueado
    iniciarReloj();          // Arrancamos el reloj que se actualiza cada segundo
    mostrarFecha();          // Mostramos la fecha en el saludo
    await cargarDatosIniciales(); // Pedimos las tareas y productos a la API
});

/*
 * cargarDatosIniciales()
 * -----------------------
 * Carga en paralelo las tareas del trabajador actual y el catálogo de productos.
 * Usa Promise.all para hacer las dos peticiones al mismo tiempo y no esperar
 * a que termine la primera para empezar la segunda (más rápido así).
 *
 * También adapta los nombres de campo de la API al formato que usa el JS interno,
 * ya que la API usa nombres como 'idTarea' pero aquí usamos 'id'.
 */
async function cargarDatosIniciales() {
    // Obtenemos el id del usuario logueado del sessionStorage
    const idUsuario = sessionStorage.getItem('usuario_id');
    try {
        // Hacemos las dos peticiones a la vez con Promise.all
        // Esperamos a que AMBAS terminen antes de continuar
        const [tareasAPI, productosAPI] = await Promise.all([
            fetch(API_URL + '/api/tareas/usuario/' + idUsuario).then(function(r) { return r.json(); }),
            fetch(API_URL + '/api/productos').then(function(r) { return r.json(); })
        ]);

        // Transformamos las tareas de la API al formato interno del JS
        // La API usa 'idTarea', 'fechaAsignacion', etc. y nosotros usamos 'id', 'fecha'...
        tareas = tareasAPI.map(function(t) {
            return {
                id:          t.idTarea,
                titulo:      t.titulo,
                descripcion: t.descripcion || '', // Si no tiene descripción, usamos cadena vacía
                fecha:       t.fechaAsignacion,
                estado:      t.estado
            };
        });

        // Transformamos los productos y calculamos el estado del stock
        // según las reglas del negocio: agotado / bajo / óptimo
        catalogo = productosAPI.map(function(p) {
            let estado;
            if (p.stockActual === 0)               estado = 'agotado'; // Sin unidades
            else if (p.stockActual < p.stockMinimo) estado = 'bajo';    // Por debajo del mínimo
            else                                    estado = 'optimo';  // Todo bien
            return {
                id:     p.idProducto,
                nombre: p.nombre,
                stock:  p.stockActual,
                estado: estado
            };
        });

        // Ya tenemos los datos, pintamos la lista de tareas en pantalla
        renderTareas();

    } catch (e) {
        // Si la API falla o no está arrancada, mostramos un mensaje de error
        console.error('Error al cargar datos:', e);
        document.getElementById('tareasLista').innerHTML =
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
 * Si no hay nombre de usuario guardado, redirigimos al login.
 * Si sí hay, mostramos el saludo personalizado.
 */
function cargarSesion() {
    const nombre = sessionStorage.getItem('usuario_nombre');
    if (!nombre) {
        // No hay sesión activa → redirigir al login para evitar acceso sin autenticación
        window.location.href = 'login.html';
        return;
    }
    // Mostramos el nombre del trabajador en el topbar
    document.getElementById('saludoTexto').textContent = 'Hola, ' + nombre;
}

/*
 * cerrarSesion()
 * ---------------
 * Borra todos los datos de sesión y vuelve al login.
 * sessionStorage.clear() elimina todo lo que se guardó al hacer login.
 */
function cerrarSesion() {
    sessionStorage.clear();
    window.location.href = 'login.html';
}

/*
 * mostrarFecha()
 * ---------------
 * Escribe la fecha de hoy en formato legible en el saludo del topbar.
 * Usamos toLocaleDateString con 'es-ES' para que salga en español.
 * Ejemplo: "jueves, 25 de abril"
 */
function mostrarFecha() {
    const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('saludoFecha').textContent = fecha;
}

// =====================================================================
// RELOJ EN TIEMPO REAL
// =====================================================================

/*
 * iniciarReloj()
 * ---------------
 * Muestra un reloj digital que se actualiza cada segundo.
 * También actualiza el tiempo trabajado si el fichaje está activo.
 *
 * Usamos setInterval para ejecutar el código repetidamente cada 1000ms (1 segundo).
 * El reloj muestra las horas y minutos grandes, y los segundos más pequeños.
 */
function iniciarReloj() {
    // Mostramos la fecha en la tarjeta del reloj (solo se necesita una vez)
    document.getElementById('relojFecha').textContent = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Actualizamos la hora cada segundo
    setInterval(function() {
        const ahora = new Date();

        // Extraemos las horas y minutos (formato HH:MM)
        const hhmm = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        // Los segundos los mostramos aparte, más pequeños (:SS)
        const ss   = ':' + String(ahora.getSeconds()).padStart(2, '0'); // padStart añade cero si es un solo dígito

        // Actualizamos los elementos del DOM
        document.getElementById('relojHora').textContent    = hhmm;
        document.getElementById('relojSegundo').textContent = ss;

        // Si el trabajador está fichado, calculamos y mostramos el tiempo que lleva trabajando
        if (fichaje.activo && fichaje.horaEntrada) {
            const diffMin = Math.floor((ahora - fichaje.horaEntrada) / 60000); // Diferencia en minutos
            const horas   = Math.floor(diffMin / 60);                          // Parte entera = horas
            const minutos = diffMin % 60;                                       // Resto = minutos
            document.getElementById('horasTrabajadas').textContent = horas + 'h ' + String(minutos).padStart(2, '0') + 'min';
        }
    }, 1000); // Se ejecuta cada 1000 milisegundos = 1 segundo
}

// =====================================================================
// SISTEMA DE FICHAJE
// =====================================================================

/*
 * toggleFichar()
 * ---------------
 * Alterna entre "fichar entrada" y "fichar salida".
 * Si no está fichado → registra la entrada y cambia el botón a rojo (salida).
 * Si ya está fichado → registra la salida y vuelve el botón a verde (entrada).
 *
 * Por ahora el fichaje solo es visual (no se guarda en la BD).
 */
function toggleFichar() {
    const ahora     = new Date();
    const horaTexto = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    // Referencias a los elementos que vamos a cambiar
    const btn     = document.getElementById('btnFichar');
    const puntoEl = document.getElementById('ficharEstado').querySelector('.estado-punto');
    const textoEl = document.getElementById('ficharTextoEstado');

    if (!fichaje.activo) {
        // ── FICHAR ENTRADA ──
        fichaje.activo      = true;      // Marcamos como activo
        fichaje.horaEntrada = ahora;     // Guardamos la hora de entrada para calcular tiempo
        fichaje.registros.push({ tipo: 'entrada', hora: horaTexto }); // Añadimos al registro

        // Cambiamos el aspecto del botón a "fichar salida" (rojo)
        btn.classList.add('btn-fichar-salida');
        document.getElementById('iconoFichar').className = 'fas fa-sign-out-alt';
        document.getElementById('textoFichar').textContent = 'FICHAR SALIDA';

        // Actualizamos el indicador de estado (punto verde pulsante)
        puntoEl.className   = 'estado-punto estado-fichado';
        textoEl.textContent = 'Entrada fichada a las ' + horaTexto;

    } else {
        // ── FICHAR SALIDA ──
        fichaje.activo      = false; // Ya no está trabajando
        fichaje.horaEntrada = null;  // Reseteamos la hora de entrada
        fichaje.registros.push({ tipo: 'salida', hora: horaTexto }); // Añadimos al registro

        // Volvemos el botón a su estado inicial (verde, entrada)
        btn.classList.remove('btn-fichar-salida');
        document.getElementById('iconoFichar').className = 'fas fa-fingerprint';
        document.getElementById('textoFichar').textContent = 'FICHAR ENTRADA';

        // Actualizamos el indicador de estado (punto gris)
        puntoEl.className   = 'estado-punto estado-sin-fichar';
        textoEl.textContent = 'Salida registrada a las ' + horaTexto;

        // Reseteamos el contador de horas trabajadas
        document.getElementById('horasTrabajadas').textContent = '0h 00min';
    }

    // Pintamos el historial de fichajes del día
    renderRegistroFichaje();
}

/*
 * renderRegistroFichaje()
 * ------------------------
 * Dibuja en pantalla el historial de entradas y salidas del día actual.
 * Recorre el array fichaje.registros y genera el HTML correspondiente.
 */
function renderRegistroFichaje() {
    const contenedor = document.getElementById('ficharRegistro');

    // Si no hay registros todavía, limpiamos el contenedor y salimos
    if (fichaje.registros.length === 0) { contenedor.innerHTML = ''; return; }

    let html = '<p class="registro-titulo">Registros de hoy:</p>';
    fichaje.registros.forEach(function(r) {
        // Elegimos el icono y la etiqueta según el tipo (entrada o salida)
        const icono = r.tipo === 'entrada' ? 'fa-arrow-right-to-bracket' : 'fa-arrow-right-from-bracket';
        const label = r.tipo === 'entrada' ? 'Entrada' : 'Salida';
        html += '<span class="registro-item registro-' + r.tipo + '"><i class="fas ' + icono + '"></i> ' + label + ': ' + r.hora + '</span>';
    });
    contenedor.innerHTML = html;
}

// =====================================================================
// RENDERIZADO DE TAREAS
// =====================================================================

/*
 * renderTareas()
 * ---------------
 * Recorre el array 'tareas' y genera el HTML de la lista de tareas.
 * Cada tarea tiene un botón circular que indica el estado actual.
 * Al pulsar ese botón se llama a cambiarEstado(id).
 *
 * Los tres estados posibles son:
 *   PENDIENTE   → círculo amarillo
 *   EN_PROGRESO → círculo azul (medio relleno)
 *   COMPLETADA  → círculo verde con check
 */
function renderTareas() {
    const lista = document.getElementById('tareasLista');
    let html = '';

    tareas.forEach(function(tarea) {
        let clase, icono, texto;

        // Determinamos la clase CSS, el icono y el texto del badge según el estado
        if (tarea.estado === 'PENDIENTE') {
            clase = 'estado-pendiente';   icono = 'fa-circle';            texto = 'Pendiente';
        } else if (tarea.estado === 'EN_PROGRESO') {
            clase = 'estado-en-progreso'; icono = 'fa-circle-half-stroke'; texto = 'En Progreso';
        } else {
            // COMPLETADA
            clase = 'estado-completada';  icono = 'fa-circle-check';       texto = 'Completada';
        }

        // Las tareas completadas tienen clase especial para mostrar texto tachado
        const completada = tarea.estado === 'COMPLETADA' ? 'tarea-completada' : '';

        // Construimos el HTML de cada item de la lista
        html += `
            <li class="tarea-item ${completada}">
                <div class="tarea-cuerpo">
                    <!-- Botón de estado: al pulsarlo cambia al siguiente estado -->
                    <button class="tarea-estado-btn ${clase}" onclick="cambiarEstado(${tarea.id})" title="Cambiar estado">
                        <i class="fas ${icono}"></i>
                    </button>
                    <div class="tarea-info">
                        <p class="tarea-titulo">${tarea.titulo}</p>
                        <p class="tarea-desc">${tarea.descripcion}</p>
                        <div class="tarea-meta">
                            <span><i class="fas fa-calendar-alt"></i> ${tarea.fecha}</span>
                            <span class="tarea-badge badge-${tarea.estado.toLowerCase().replace('_','-')}">${texto}</span>
                        </div>
                    </div>
                </div>
            </li>`;
    });

    lista.innerHTML = html;
    actualizarContadores(); // Actualizamos los números de las estadísticas
}

/*
 * cambiarEstado(id)
 * ------------------
 * Cambia el estado de una tarea al siguiente en el ciclo:
 *   PENDIENTE → EN_PROGRESO → COMPLETADA → PENDIENTE → ...
 *
 * Hace una petición PUT a la API para persistir el cambio en la base de datos.
 * Solo actualiza la lista en pantalla si la API confirma que fue bien.
 *
 * Parámetros:
 *   id → identificador de la tarea a cambiar
 */
async function cambiarEstado(id) {
    // El ciclo define el orden de los estados
    const ciclo = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADA'];

    // Buscamos la tarea en el array local por su id
    const tarea = tareas.find(function(t) { return t.id === id; });
    if (!tarea) return; // Si no la encontramos, no hacemos nada

    // Calculamos el siguiente estado en el ciclo usando módulo (%)
    // Si estamos en el último (COMPLETADA), el % lo lleva de vuelta a 0 (PENDIENTE)
    const siguiente = ciclo[(ciclo.indexOf(tarea.estado) + 1) % ciclo.length];

    try {
        // Enviamos el nuevo estado a la API
        const response = await fetch(API_URL + '/api/tareas/' + id + '/estado', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: siguiente })
        });

        if (response.ok) {
            // Solo actualizamos el estado local si la API lo confirma
            // Así evitamos que la pantalla muestre datos incorrectos si falla el servidor
            tarea.estado = siguiente;
            renderTareas(); // Repintamos la lista con el nuevo estado
        }
    } catch (e) {
        console.error('Error al cambiar estado:', e);
    }
}

/*
 * actualizarContadores()
 * -----------------------
 * Recuenta las tareas por estado y actualiza los números en las tarjetas
 * de estadísticas que aparecen debajo del fichaje.
 * También actualiza el badge de "X pendientes" en la cabecera de la lista.
 */
function actualizarContadores() {
    // Filtramos el array por cada estado y contamos cuántos hay
    const pendiente  = tareas.filter(function(t) { return t.estado === 'PENDIENTE';   }).length;
    const progreso   = tareas.filter(function(t) { return t.estado === 'EN_PROGRESO'; }).length;
    const completada = tareas.filter(function(t) { return t.estado === 'COMPLETADA';  }).length;

    // Actualizamos los valores en el HTML
    document.getElementById('statTotal').textContent      = tareas.length;
    document.getElementById('statPendiente').textContent  = pendiente;
    document.getElementById('statProgreso').textContent   = progreso;
    document.getElementById('statCompletada').textContent = completada;

    // Badge de pendientes (con plural correcto: "1 pendiente" / "2 pendientes")
    document.getElementById('badgePendientes').textContent = pendiente + ' pendiente' + (pendiente !== 1 ? 's' : '');
}

// =====================================================================
// MODAL DE NUEVA TAREA
// =====================================================================

/*
 * abrirModal()
 * -------------
 * Abre el modal para registrar una nueva tarea.
 * Limpia todos los campos primero para que no queden datos del uso anterior.
 * Pone el foco en el título para que el usuario empiece a escribir directamente.
 */
function abrirModal() {
    // Limpiamos todos los campos del formulario del modal
    document.getElementById('modalTitulo').value       = '';
    document.getElementById('modalDescripcion').value  = '';
    document.getElementById('modalEstado').value       = 'PENDIENTE'; // Estado por defecto
    document.getElementById('errorTitulo').textContent = '';

    // Añadimos la clase que hace visible el overlay y el modal
    document.getElementById('modalOverlay').classList.add('modal-visible');
    document.getElementById('modalTarea').classList.add('modal-visible');

    // Ponemos el foco en el input del título después de un pequeño retraso
    // (necesario porque la transición de apertura del modal tarda un poco)
    setTimeout(function() { document.getElementById('modalTitulo').focus(); }, 100);
}

/*
 * cerrarModal()
 * --------------
 * Cierra el modal quitando la clase que lo hace visible.
 * Al quitarla, la transición CSS lo oculta suavemente.
 */
function cerrarModal() {
    document.getElementById('modalOverlay').classList.remove('modal-visible');
    document.getElementById('modalTarea').classList.remove('modal-visible');
}

/*
 * guardarTarea()
 * ---------------
 * Recoge los datos del formulario del modal, valida que el título no esté vacío
 * y envía la nueva tarea a la API mediante POST.
 *
 * Si la API la crea correctamente:
 *   - Añadimos la tarea al principio del array local (unshift)
 *   - Repintamos la lista
 *   - Cerramos el modal
 */
async function guardarTarea() {
    // Recogemos los valores del formulario
    const titulo      = document.getElementById('modalTitulo').value.trim();
    const descripcion = document.getElementById('modalDescripcion').value.trim();
    const estado      = document.getElementById('modalEstado').value;
    const idUsuario   = parseInt(sessionStorage.getItem('usuario_id')); // Necesario para asignar la tarea

    // Validación básica: el título es obligatorio
    if (!titulo) {
        document.getElementById('errorTitulo').textContent = 'El título es obligatorio.';
        document.getElementById('modalTitulo').focus();
        return; // Detenemos la función aquí si no hay título
    }

    // Generamos la fecha de hoy en formato DD/MM/YYYY (el formato que usa la API)
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    try {
        // Enviamos la nueva tarea a la API con POST
        const response = await fetch(API_URL + '/api/tareas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo:          titulo,
                descripcion:     descripcion || 'Sin descripción.', // Valor por defecto si no pone nada
                fechaAsignacion: fecha,
                estado:          estado,
                idUsuario:       idUsuario
            })
        });

        if (response.ok) {
            const nuevaTarea = await response.json(); // La API nos devuelve la tarea creada con su id

            // Añadimos la tarea al INICIO del array para que aparezca primera en la lista
            tareas.unshift({
                id:          nuevaTarea.idTarea,
                titulo:      nuevaTarea.titulo,
                descripcion: nuevaTarea.descripcion,
                fecha:       nuevaTarea.fechaAsignacion,
                estado:      nuevaTarea.estado
            });

            renderTareas(); // Repintamos la lista
            cerrarModal();  // Cerramos el modal
        }
    } catch (e) {
        console.error('Error al guardar tarea:', e);
    }
}

// =====================================================================
// BUSCADOR DE STOCK
// =====================================================================

/*
 * buscarProducto(consulta)
 * -------------------------
 * Filtra el catálogo de productos por el texto escrito en el buscador.
 * La búsqueda no distingue entre mayúsculas y minúsculas.
 *
 * Muestra los resultados con su badge de estado de stock:
 *   - badge-ok      → stock óptimo (verde)
 *   - badge-aviso   → stock bajo (amarillo)
 *   - badge-peligro → agotado (rojo)
 *
 * Parámetros:
 *   consulta → texto que ha escrito el usuario en el buscador
 */
function buscarProducto(consulta) {
    const contenedor = document.getElementById('busquedaResultados');

    // Si el campo está vacío, limpiamos los resultados y salimos
    if (!consulta.trim()) { contenedor.innerHTML = ''; return; }

    // Filtramos el catálogo buscando el texto en el nombre del producto
    const resultados = catalogo.filter(function(p) {
        return p.nombre.toLowerCase().includes(consulta.toLowerCase());
    });

    // Si no hay coincidencias, mostramos un mensaje de "no encontrado"
    if (resultados.length === 0) {
        contenedor.innerHTML = '<p class="busqueda-vacio">No se encontraron productos.</p>';
        return;
    }

    // Generamos el HTML para cada resultado encontrado
    let html = '';
    resultados.forEach(function(p) {
        let clase, texto;
        if (p.estado === 'optimo')      { clase = 'badge-ok';      texto = 'Óptimo';     }
        else if (p.estado === 'bajo')   { clase = 'badge-aviso';   texto = 'Bajo Stock'; }
        else                            { clase = 'badge-peligro'; texto = 'Agotado';    }

        html += `
            <div class="resultado-item">
                <div>
                    <p class="resultado-nombre">${p.nombre}</p>
                    <p class="resultado-ref">Stock: <strong>${p.stock}</strong> uds.</p>
                </div>
                <span class="badge ${clase}">${texto}</span>
            </div>`;
    });
    contenedor.innerHTML = html;
}
