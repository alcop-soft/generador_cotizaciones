// Formato de moneda en pesos colombianos
function formatoPeso(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

// Variables globales
let productos = [];
let descuentoGeneral = 0;

function leerImagenProducto() {
    const inputImagen = document.getElementById("imagenProducto");
    const archivo = inputImagen && inputImagen.files ? inputImagen.files[0] : null;

    if (!archivo) {
        return Promise.resolve("");
    }

    return new Promise((resolve) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = () => resolve("");
        lector.readAsDataURL(archivo);
    });
}

// Inicializacion
document.addEventListener('DOMContentLoaded', function() {
    // Fecha automatica
    const fecha = new Date();
    const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
    const fechaFormateada = fecha.toLocaleDateString('es-CO', opciones);
    document.getElementById("fecha").innerText = "Pereira, " + fechaFormateada;

    // Configurar eventos
    document.getElementById('agregarProducto').addEventListener('click', agregarProducto);
    document.getElementById('aplicarDescuento').addEventListener('click', aplicarDescuentoGeneral);
    document.getElementById('generarPDF').addEventListener('click', function() {
        window.print();
    });

    // Evento para cambiar genero
    document.getElementById('genero').addEventListener('change', function() {
        actualizarSaludo();
    });

    const vendedorInput = document.getElementById('vendedor');
    if (vendedorInput) {
        vendedorInput.addEventListener('input', actualizarNombreVendedor);
    }

    actualizarSaludo();
    actualizarNombreVendedor();
    renderizarTabla();
});

// Funcion para agregar producto
async function agregarProducto() {
    const cliente = document.getElementById("cliente").value;
    const producto = document.getElementById("producto").value;
    const cantidad = parseFloat(document.getElementById("cantidad").value);
    const precio = parseFloat(document.getElementById("precio").value);
    const imagen = await leerImagenProducto();

    if (!producto || !cantidad || !precio) {
        alert("Por favor complete todos los campos requeridos");
        return;
    }

    // Calcular subtotal
    const subtotal = cantidad * precio;

    // Crear objeto producto
    const nuevoProducto = {
        id: Date.now(),
        descripcion: producto,
        cantidad: cantidad,
        precio: precio,
        subtotal: subtotal,
        imagen: imagen
    };

    // Agregar a la lista
    productos.push(nuevoProducto);

    // Actualizar UI
    document.getElementById("nombreCliente").innerText = cliente;
    renderizarTabla();
    calcularTotales();

    // Limpiar campos
    document.getElementById("producto").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagenProducto").value = "";
}

// Funcion para aplicar descuento general
function aplicarDescuentoGeneral() {
    const descuentoInput = document.getElementById("descuentoGeneral").value;
    descuentoGeneral = parseFloat(descuentoInput) || 0;
    renderizarTabla();
    calcularTotales();
}

// Funcion para eliminar producto
function eliminarProducto(id) {
    productos = productos.filter(producto => producto.id !== id);
    renderizarTabla();
    calcularTotales();
}

// Funcion para renderizar la tabla
function renderizarTabla() {
    const tbody = document.getElementById("tablaBody");
    const columnaImagen = document.getElementById("columnaImagen");
    const mostrarColumnaImagen = productos.some(producto => Boolean(producto.imagen));
    tbody.innerHTML = "";

    if (columnaImagen) {
        columnaImagen.style.display = mostrarColumnaImagen ? "" : "none";
    }

    if (productos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">No hay productos agregados</td>
            </tr>
        `;
        return;
    }

    productos.forEach(producto => {
        const tr = document.createElement('tr');
        const imagenCelda = producto.imagen
            ? `<img src="${producto.imagen}" alt="Imagen de ${producto.descripcion}" class="producto-img">`
            : `<span class="text-muted">Sin imagen</span>`;

        tr.innerHTML = `
            <td>${producto.descripcion}</td>
            <td class="text-center">${producto.cantidad}</td>
            <td class="text-end">${formatoPeso(producto.precio)}</td>
            <td class="text-end">${formatoPeso(producto.subtotal)}</td>
            ${mostrarColumnaImagen ? `<td class="text-center">${imagenCelda}</td>` : ""}
            <td class="text-center">
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id})">
                    <i class="bi bi-trash"></i> Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Funcion para calcular totales
function calcularTotales() {
    const subtotal = productos.reduce((acc, producto) => acc + producto.subtotal, 0);
    const valorDescuento = subtotal * (descuentoGeneral / 100);
    const total = subtotal - valorDescuento;

    document.getElementById("subtotal").innerText = formatoPeso(subtotal);
    document.getElementById("descuentoValor").innerText = formatoPeso(valorDescuento);
    document.getElementById("totalGeneral").innerText = formatoPeso(total);

    // Mostrar seccion de descuento si hay descuento
    const descuentoSection = document.getElementById("descuentoSection");
    if (descuentoGeneral > 0) {
        descuentoSection.classList.add("visible");
    } else {
        descuentoSection.classList.remove("visible");
    }
}

// Funcion para actualizar saludo segun genero
function actualizarSaludo() {
    const genero = document.getElementById("genero").value;
    const nombre = document.getElementById("cliente").value;
    const saludo = `${genero}:`;

    document.getElementById("saludoGenero").innerText = saludo;
    document.getElementById("nombreCliente").innerText = nombre;
}

function actualizarNombreVendedor() {
    const vendedorInput = document.getElementById("vendedor");
    const nombreVendedor = document.getElementById("nombreVendedor");

    if (!nombreVendedor) {
        return;
    }

    const nombre = vendedorInput ? vendedorInput.value.trim() : "";
    nombreVendedor.innerText = nombre || "ALCOP.";
}

// Funcion para exportar a PDF (usando print)
function exportarPDF() {
    window.print();
}
