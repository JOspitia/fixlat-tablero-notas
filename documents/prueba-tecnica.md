# Prueba técnica: Portal de equipo con tablero de notas

Desarrolla una aplicación web para que un equipo consulte su actividad, administre sus usuarios y organice notas en un tablero compartido.

Dispones de tres días calendario desde la recepción del enunciado para entregar el proyecto, con un máximo de ocho horas de trabajo efectivo. Indica en la entrega el tiempo empleado y cualquier parte que haya quedado pendiente.

Puedes elegir el lenguaje, los frameworks, las librerías y la base de datos. Tienes permiso para utilizar inteligencia artificial libremente durante toda la prueba, incluyendo la generación, modificación y revisión de código y documentación. Puedes utilizar las herramientas y modelos que prefieras.

---

## 1. Acceso y usuarios

La aplicación debe permitir iniciar y cerrar sesión. El dashboard, el tablero y la administración de usuarios pertenecen al área de usuarios autenticados.

Existen dos roles:

* **Administrador:** puede utilizar el tablero y el dashboard, además de administrar usuarios.
* **Usuario:** puede utilizar el tablero y el dashboard.

La administración debe permitir listar, crear y editar usuarios, asignar su rol y desactivarlos o reactivarlos. Cada usuario tiene nombre, correo electrónico, rol y estado activo o inactivo. Los usuarios inactivos no pueden acceder ni continuar utilizando el área autenticada. Debe conservarse siempre al menos un administrador activo.

Incluye cuentas de demostración para ambos roles y explica cómo acceder a ellas y cómo puede iniciar sesión un usuario creado desde la aplicación.

---

## 2. Tablero compartido de notas

Implementa un único tablero compartido, presentado como un lienzo libre con notas tipo post-it, sin columnas. Todos los usuarios activos pueden crear, editar, mover y eliminar todas las notas del tablero.

Cada nota debe tener:

* **Título**
* **Texto**
* **Estado:** Pendiente, En curso o Hecho.
* **Posición dentro del lienzo**

El usuario debe poder escribir y editar el título, el texto y el estado directamente sobre la nota, y confirmar esos cambios mediante una acción de **Guardar**. También debe poder eliminar una nota que ya no necesite.

Las notas se deben poder mover libremente con el ratón mediante arrastrar y soltar. Al soltar una nota, su nueva posición se guarda automáticamente. El contenido, el estado y la posición deben conservarse al recargar la aplicación y al reiniciar el entorno local sin eliminar sus datos persistentes.

---

## 3. Dashboard

Incluye un dashboard que muestre el número total de notas y su distribución por estado. Estas cifras deben reflejar los datos del tablero; pueden actualizarse al volver a abrir o recargar el dashboard.

El cálculo y la entrega de estas métricas deben utilizar al menos una función AWS Lambda. La forma de conectar el frontend, la API, Lambda y el almacenamiento queda a tu elección.

---

## 4. Ejecución local y arquitectura AWS

El proyecto debe poder ejecutarse y demostrarse completamente en local. Incluye Docker Compose, los Dockerfiles necesarios y las instrucciones para levantar el entorno y cargar las cuentas de demostración. La persistencia y el mecanismo de inicialización quedan a tu elección.

Puedes utilizar AWS SAM local, LocalStack u otras herramientas para ejecutar o emular los servicios necesarios. La ejecución local entregada no debe depender de una cuenta AWS, un despliegue remoto ni una suscripción de pago. Si utilizas una herramienta que requiere esos recursos, proporciona también una alternativa local que cumpla esta condición.

Prepara la arquitectura de despliegue en AWS con los siguientes elementos:

* **EC2:** ejecución de la API de usuarios y notas dentro de un contenedor Docker.
* **Lambda:** cálculo y entrega de las métricas del dashboard.
* **S3 y CloudFront:** almacenamiento y distribución del frontend.

Incluye infraestructura como código mediante AWS SAM y CloudFormation, junto con los archivos o scripts necesarios para desplegar utilizando AWS CLI y AWS SAM y para retirar los recursos creados por la aplicación. Documenta los parámetros y requisitos del despliegue. Elige el almacenamiento y cualquier recurso adicional que necesites para conectar estos elementos.

EC2 y CloudFront no necesitan emularse en local: la API puede ejecutarse mediante Docker Compose y el frontend puede servirse desde un contenedor. Lambda debe poder ejecutarse localmente mediante el mecanismo documentado. La configuración de AWS debe corresponder al proyecto entregado.

No es obligatorio desplegar en AWS ni asumir gastos de nube. Si decides hacerlo, puedes incluir una URL funcional, que podrá aportar una valoración adicional de la entrega. Esto no sustituye el proyecto ejecutable en local ni el video.

---

## 5. Alcance

Concéntrate en las funciones descritas. No se requieren tableros múltiples, columnas, asignación de notas, fechas de vencimiento, comentarios, adjuntos, notificaciones, historial, colaboración en tiempo real ni aplicaciones móviles nativas.

---

## 6. Entrega

Entrega lo siguiente dentro de los tres días calendario:

1. **Proyecto completo:** Mediante un repositorio accesible para la revisión o un archivo comprimido, con el código y los archivos de ejecución y despliegue. Identifica la versión entregada mediante el commit del repositorio o el archivo enviado.


2. **README:** Con los requisitos, comandos de arranque, cuentas de demostración, instrucciones de uso, funcionamiento de la persistencia e instrucciones de despliegue y retirada en AWS. Incluye una explicación breve de la arquitectura, el tiempo empleado y las limitaciones o pendientes conocidos.


3. **Video de máximo ocho minutos:** Como archivo o enlace accesible, mostrando la aplicación en funcionamiento y explicando brevemente su organización y arquitectura. Demuestra el acceso, las diferencias entre roles, la gestión de usuarios, la creación, edición y eliminación de notas, el movimiento y conservación de sus posiciones, y el dashboard. Puedes grabarlo sobre la ejecución local o sobre AWS.


4. **URL del despliegue AWS (si aplica):** Si lo realizaste, junto con las instrucciones necesarias para acceder.



El proyecto debe poder revisarse a partir de la entrega y sus instrucciones, sin depender de una sesión de asistencia con el candidato.