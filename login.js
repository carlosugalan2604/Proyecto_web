// login.js — Lógica del formulario de inicio de sesión
// Autor: Carlos Ugarte Galán

// Aquí guardamos la dirección donde está escuchando nuestra API Spring Boot.
// Si la API cambia de puerto, solo hay que cambiar este valor.
const API_URL = 'http://localhost:8085';

// Objeto que relaciona cada rol con la página HTML a la que debe ir.
// Cuando el login es correcto, miramos aquí para saber a dónde redirigir al usuario.
const RUTAS = {
    GERENTE:    'panel_gerente.html',  // El gerente va a su panel de control
    TRABAJADOR: 'trabajador.html',     // El trabajador va a su panel
    CLIENTE:    'cliente.html'         // El cliente va a ver sus pedidos
};

/*
 * togglePassword()
 * ----------------
 * Muestra u oculta la contraseña cuando el usuario pulsa el icono del ojo.
 * Cambia el tipo del input entre 'password' (oculto) y 'text' (visible).
 * También cambia el icono del ojo para que el usuario sepa en qué estado está.
 */
function togglePassword() {
    const input = document.getElementById('inputPassword');
    const icono = document.getElementById('iconoOjo');

    // Si la contraseña está oculta la mostramos, y al revés
    if (input.type === 'password') {
        input.type = 'text';                  // Ahora se ve el texto
        icono.className = 'fas fa-eye-slash'; // El ojo tachado indica que se puede ocultar
    } else {
        input.type = 'password';         // Volvemos a ocultar
        icono.className = 'fas fa-eye';  // El ojo normal indica que se puede ver
    }
}

/*
 * rellenarCredencial(email, password)
 * ------------------------------------
 * Rellena los campos del formulario con las credenciales de prueba
 * cuando el usuario pulsa uno de los pills de demostración.
 * Así no hace falta escribir el email y la contraseña a mano al probar.
 *
 * Parámetros:
 *   email    → correo electrónico de prueba
 *   password → contraseña de prueba
 */
function rellenarCredencial(email, password) {
    document.getElementById('inputEmail').value    = email;
    document.getElementById('inputPassword').value = password;
    limpiarErrores(); // También limpiamos los errores por si había alguno
}

/*
 * limpiarErrores()
 * ----------------
 * Elimina todos los mensajes de error del formulario.
 * Se llama antes de cada validación para empezar desde cero,
 * y también al rellenar con credenciales de prueba.
 */
function limpiarErrores() {
    // Vaciamos el texto de los mensajes de error
    document.getElementById('errorEmail').textContent    = '';
    document.getElementById('errorPassword').textContent = '';

    // Ocultamos la alerta roja general
    document.getElementById('alertaGeneral').style.display = 'none';

    // Quitamos la clase de error visual (borde rojo) de los campos
    document.getElementById('campoEmail').classList.remove('campo-error');
    document.getElementById('campoPassword').classList.remove('campo-error');
}

/*
 * mostrarError(idCampo, idSpan, mensaje)
 * ---------------------------------------
 * Muestra un mensaje de error debajo de un campo concreto.
 * Aplica el estilo visual de error (borde rojo) al div contenedor del campo.
 *
 * Parámetros:
 *   idCampo  → id del div que contiene el input (para ponerle el borde rojo)
 *   idSpan   → id del span donde se escribe el mensaje de error
 *   mensaje  → texto del error que verá el usuario
 */
function mostrarError(idCampo, idSpan, mensaje) {
    document.getElementById(idCampo).classList.add('campo-error'); // Borde rojo
    document.getElementById(idSpan).textContent = mensaje;         // Texto de error
}

/*
 * validarFormulario()
 * -------------------
 * Comprueba que el email y la contraseña son correctos ANTES de enviar
 * la petición a la API. Así evitamos llamadas innecesarias al servidor.
 *
 * Validaciones que hace:
 *   - El email no puede estar vacío
 *   - El email tiene que tener formato válido (contiene @ y punto)
 *   - La contraseña no puede estar vacía
 *   - La contraseña tiene que tener al menos 4 caracteres
 *
 * Devuelve:
 *   true  → el formulario está bien, podemos continuar
 *   false → hay errores, no enviamos nada
 */
function validarFormulario() {
    const email    = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value;
    let valido = true; // Asumimos que todo está bien hasta que encontremos un error

    // Validamos el email
    if (!email) {
        // El campo está vacío
        mostrarError('campoEmail', 'errorEmail', 'El correo es obligatorio.');
        valido = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // No tiene formato de email válido (comprobamos con expresión regular)
        mostrarError('campoEmail', 'errorEmail', 'Introduce un correo válido.');
        valido = false;
    }

    // Validamos la contraseña
    if (!password) {
        // El campo está vacío
        mostrarError('campoPassword', 'errorPassword', 'La contraseña es obligatoria.');
        valido = false;
    } else if (password.length < 4) {
        // Es demasiado corta (menos de 4 caracteres)
        mostrarError('campoPassword', 'errorPassword', 'Mínimo 4 caracteres.');
        valido = false;
    }

    return valido;
}

/*
 * intentarLogin()
 * ----------------
 * Función principal del login. Envía las credenciales a la API y gestiona
 * la respuesta. Es async porque hace una llamada HTTP que tarda un tiempo.
 *
 * Pasos que sigue:
 *   1. Muestra un spinner en el botón para que el usuario sepa que se está procesando
 *   2. Hace la petición POST a /api/usuarios/login con el email y contraseña
 *   3. Si la API responde OK: guarda los datos en sessionStorage y redirige
 *   4. Si la API responde con error (401): muestra mensaje de credenciales incorrectas
 *   5. Si no hay conexión: avisa de que la API no está arrancada
 *   6. Siempre restaura el botón al terminar (bloque finally)
 */
async function intentarLogin() {
    // Obtenemos los valores del formulario (el email lo ponemos en minúsculas para evitar errores)
    const email    = document.getElementById('inputEmail').value.trim().toLowerCase();
    const password = document.getElementById('inputPassword').value;

    // Paso 1: Mostramos el spinner y desactivamos el botón para evitar doble clic
    document.querySelector('.btn-texto').style.display  = 'none';   // Ocultamos texto
    document.getElementById('btnSpinner').style.display = 'inline'; // Mostramos spinner
    document.getElementById('btnLogin').disabled        = true;      // Desactivamos botón

    try {
        // Paso 2: Enviamos las credenciales a la API con fetch
        // method: 'POST' porque enviamos datos, no los pedimos
        // body: convertimos el objeto JS a JSON para enviarlo
        const response = await fetch(API_URL + '/api/usuarios/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
        });

        if (response.ok) {
            // Paso 3: La API respondió bien (código 200) → guardamos datos y redirigimos
            const usuario = await response.json(); // Convertimos la respuesta a objeto JS

            // Guardamos en sessionStorage para usarlos en otros archivos JS
            // sessionStorage se borra automáticamente al cerrar el navegador
            sessionStorage.setItem('usuario_id',     String(usuario.idUsuario));
            sessionStorage.setItem('usuario_nombre', usuario.nombre);
            sessionStorage.setItem('usuario_email',  usuario.email);
            sessionStorage.setItem('usuario_rol',    usuario.rol);

            // Redirigimos al panel según el rol del usuario
            window.location.href = RUTAS[usuario.rol];
        } else {
            // Paso 4: La API rechazó las credenciales (código 401)
            mostrarAlertaError('Correo o contraseña incorrectos.');
        }

    } catch (e) {
        // Paso 5: No se pudo conectar (la API no está arrancada o hay problemas de red)
        mostrarAlertaError('No se puede conectar con el servidor. ¿Está la API arrancada?');
    } finally {
        // Paso 6: Esto se ejecuta SIEMPRE, haya error o no
        // Restauramos el botón para que el usuario pueda volver a intentarlo
        document.querySelector('.btn-texto').style.display  = 'inline';
        document.getElementById('btnSpinner').style.display = 'none';
        document.getElementById('btnLogin').disabled        = false;
    }
}

/*
 * mostrarAlertaError(mensaje)
 * ----------------------------
 * Muestra la caja de error roja con el mensaje recibido.
 * Aplica una animación de "temblor" (shake) para llamar la atención
 * del usuario sobre el error.
 *
 * El truco del void alerta.offsetWidth es para reiniciar la animación CSS:
 * forzamos al navegador a recalcular los estilos antes de añadir la clase.
 */
function mostrarAlertaError(mensaje) {
    const alerta = document.getElementById('alertaGeneral');
    const span   = alerta.querySelector('span');

    if (span) span.textContent = mensaje; // Ponemos el texto del error

    alerta.style.display = 'flex';        // Hacemos visible la alerta

    // Reiniciamos la animación: quitamos la clase, forzamos reflow, la volvemos a añadir
    alerta.classList.remove('shake');
    void alerta.offsetWidth; // Esta línea "engaña" al navegador para reiniciar la animación
    alerta.classList.add('shake');
}

/*
 * DOMContentLoaded
 * -----------------
 * Este bloque espera a que el HTML esté completamente cargado antes de
 * registrar los eventos. Sin esto, el JS intentaría buscar elementos
 * que todavía no existen en el DOM y daría error.
 */
document.addEventListener('DOMContentLoaded', function() {

    // Al enviar el formulario (pulsar Enter o el botón), ejecutamos el login
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
        e.preventDefault(); // Evitamos el comportamiento por defecto (recargar la página)
        limpiarErrores();   // Borramos errores anteriores antes de volver a validar

        // Solo llamamos a la API si la validación local pasa
        if (validarFormulario()) {
            await intentarLogin();
        }
    });

    // Cuando el usuario empieza a escribir en el email, quitamos el error visual
    // para que no vea el borde rojo mientras está corrigiendo
    document.getElementById('inputEmail').addEventListener('input', function() {
        document.getElementById('campoEmail').classList.remove('campo-error');
        document.getElementById('errorEmail').textContent = '';
    });

    // Lo mismo para el campo de contraseña
    document.getElementById('inputPassword').addEventListener('input', function() {
        document.getElementById('campoPassword').classList.remove('campo-error');
        document.getElementById('errorPassword').textContent = '';
    });
});
