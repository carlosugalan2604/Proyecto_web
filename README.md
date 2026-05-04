  ## README — Web

  ```markdown
  # DI-PYMES — Interfaz Web

  Interfaz web para la gestión empresarial de PYMEs desarrollada con HTML, CSS y JavaScript vanilla.
  Se conecta a la misma API REST que la app Android.
  El acceso a cada panel está protegido por rol.

  ## Tecnologías

  - HTML5 / CSS3 puro
  - JavaScript vanilla
  - Font Awesome 6.4.0

  ## Credenciales de prueba

  | Email                     | Contraseña | Rol        | Panel de destino    |
  |---------------------------|------------|------------|---------------------|
  | gerente@dipymes.com       | 1234       | GERENTE    | panel_gerente.html  |
  | trabajador@dipymes.com    | 1234       | TRABAJADOR | trabajador.html     |
  | cliente@dipymes.com       | 1234       | CLIENTE    | cliente.html        |

  ## Puesta en marcha

  1. Arranca la API DI-PYMES en `http://localhost:8085`.
  2. Abre `login.html` en el navegador o con **Live Server** desde VS Code.
  3. Inicia sesión con cualquiera de las credenciales de prueba.

  > Si accedes desde otra máquina de la red, sustituye `localhost` por la IP
  > del servidor en la variable `API_BASE` de cada archivo JS.

  # Como en el README de la parte de la app, con estas instrucciones será suficiente para acceder a los tres roles y comprobar el funcionamiento de     todos ellos en el proyecto 
