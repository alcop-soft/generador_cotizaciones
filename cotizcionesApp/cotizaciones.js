function formatoPeso(valor) {
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        minimumFractionDigits: 0
    }).format(valor);
}

function formatoNumero(valor) {
    return new Intl.NumberFormat("es-CO", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(valor);
}

function normalizarTexto(texto) {
    return (texto || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function esProductoInstalacion(producto) {
    return normalizarTexto(producto.descripcion).includes("instalacion");
}

function esProductoSinDescuento(producto) {
    const descripcion = normalizarTexto(producto.descripcion);
    return descripcion.includes("instalacion") || descripcion.includes("mantenimiento");
}

let productos = [];
let descuentoGeneral = 0;
let tablaCounter = 1;
let productoEditandoId = null;
let editarInstalacionModal = null;

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

document.addEventListener("DOMContentLoaded", () => {
    const fecha = new Date();
    const opcionesFecha = { day: "numeric", month: "long", year: "numeric" };
    const fechaFormateada = fecha.toLocaleDateString("es-CO", opcionesFecha);
    document.getElementById("fecha").innerText = `Pereira, ${fechaFormateada}`;

    document.getElementById("agregarProducto").addEventListener("click", agregarProducto);
    document.getElementById("aplicarDescuento").addEventListener("click", aplicarDescuentoGeneral);
    document.getElementById("generarPDF").addEventListener("click", () => window.print());
    document.getElementById("agregarTabla").addEventListener("click", agregarNuevaTabla);
    document.getElementById("genero").addEventListener("change", actualizarSaludo);
    document.getElementById("cliente").addEventListener("input", actualizarSaludo);
    document.getElementById("guardarEdicionInstalacion").addEventListener("click", guardarEdicionProducto);

    const vendedorInput = document.getElementById("vendedor");
    if (vendedorInput) {
        vendedorInput.addEventListener("input", actualizarNombreVendedor);
    }

    if (window.bootstrap) {
        const modalElement = document.getElementById("editarInstalacionModal");
        editarInstalacionModal = new window.bootstrap.Modal(modalElement);
    }

    actualizarSaludo();
    actualizarNombreVendedor();
    renderizarTabla();
    calcularTotales();
});

async function agregarProducto() {
    const cliente = document.getElementById("cliente").value.trim();
    const producto = document.getElementById("producto").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("cantidad").value);
    const precio = Number.parseFloat(document.getElementById("precio").value);
    const imagen = await leerImagenProducto();

    if (!producto || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete producto, cantidad y precio con valores válidos.");
        return;
    }

    const subtotal = cantidad * precio;

    productos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        descripcion: producto,
        cantidad,
        precio,
        subtotal,
        imagen,
        opcion: tablaCounter
    });

    document.getElementById("nombreCliente").innerText = cliente;
    renderizarTabla();
    calcularTotales();

    document.getElementById("producto").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagenProducto").value = "";
}

function aplicarDescuentoGeneral() {
    const descuentoInput = Number.parseFloat(document.getElementById("descuentoGeneral").value);

    if (!Number.isFinite(descuentoInput)) {
        descuentoGeneral = 0;
    } else {
        descuentoGeneral = Math.max(0, Math.min(100, descuentoInput));
    }

    document.getElementById("descuentoGeneral").value = descuentoGeneral;
    renderizarTabla();
    calcularTotales();
}

function eliminarProducto(id) {
    productos = productos.filter((producto) => producto.id !== id);
    renderizarTabla();
    calcularTotales();
}

function abrirModalEdicion(id) {
    const producto = productos.find((item) => item.id === id);
    if (!producto) {
        return;
    }

    productoEditandoId = id;
    document.getElementById("editarDescripcion").value = producto.descripcion;
    document.getElementById("editarCantidad").value = producto.cantidad;
    document.getElementById("editarPrecio").value = producto.precio;

    if (editarInstalacionModal) {
        editarInstalacionModal.show();
    }
}

function guardarEdicionProducto() {
    if (productoEditandoId === null) {
        return;
    }

    const descripcion = document.getElementById("editarDescripcion").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("editarCantidad").value);
    const precio = Number.parseFloat(document.getElementById("editarPrecio").value);

    if (!descripcion || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete descripción, cantidad y precio con valores válidos.");
        return;
    }

    const indice = productos.findIndex((item) => item.id === productoEditandoId);
    if (indice === -1) {
        return;
    }

    productos[indice].descripcion = descripcion;
    productos[indice].cantidad = cantidad;
    productos[indice].precio = precio;
    productos[indice].subtotal = cantidad * precio;

    renderizarTabla();
    calcularTotales();

    if (editarInstalacionModal) {
        editarInstalacionModal.hide();
    }

    productoEditandoId = null;
}

function agregarNuevaTabla() {
    tablaCounter += 1;
    alert(`Nueva opción ${tablaCounter} creada. Los siguientes productos pertenecerán a esta opción.`);
}

function renderizarTabla() {
    const tbody = document.getElementById("tablaBody");
    const columnaImagen = document.getElementById("columnaImagen");
    const mostrarColumnaImagen = productos.some((producto) => Boolean(producto.imagen));

    tbody.innerHTML = "";
    if (columnaImagen) {
        columnaImagen.style.display = mostrarColumnaImagen ? "" : "none";
    }

    if (productos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${mostrarColumnaImagen ? 6 : 5}" class="text-center text-muted">No hay productos agregados</td>
            </tr>
        `;
        return;
    }

    const opciones = agruparPorOpcion(productos);
    const llaves = Object.keys(opciones).sort((a, b) => Number(a) - Number(b));
    const numeroOpciones = llaves.length;

    llaves.forEach((opcion) => {
        const productosOpcion = opciones[opcion];

        if (numeroOpciones > 1) {
            const trHeader = document.createElement("tr");
            trHeader.innerHTML = `
                <td colspan="${mostrarColumnaImagen ? 6 : 5}" class="bg-light fw-bold">OPCIÓN ${opcion}</td>
            `;
            tbody.appendChild(trHeader);
        }

        productosOpcion.forEach((producto) => {
            const tr = document.createElement("tr");
            const imagenCelda = producto.imagen
                ? `<img src="${producto.imagen}" alt="Imagen de ${producto.descripcion}" class="producto-img">`
                : '<span class="text-muted">Sin imagen</span>';
            const botonEditar = `
                <button class="btn btn-sm btn-primary me-1" onclick="abrirModalEdicion(${producto.id})">
                    <i class="bi bi-pencil-square"></i> Editar
                </button>
            `;

            tr.innerHTML = `
                <td>${producto.descripcion}</td>
                <td class="text-center">${formatoNumero(producto.cantidad)}</td>
                <td class="text-end">${formatoPeso(producto.precio)}</td>
                <td class="text-end">${formatoPeso(producto.subtotal)}</td>
                ${mostrarColumnaImagen ? `<td class="text-center">${imagenCelda}</td>` : ""}
                <td class="text-center">
                    ${botonEditar}
                    <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id})">
                        <i class="bi bi-trash"></i> Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        if (numeroOpciones > 1) {
            const totalOpcion = productosOpcion.reduce((acc, producto) => acc + producto.subtotal, 0);
            const trTotal = document.createElement("tr");
            trTotal.innerHTML = `
                <td colspan="${mostrarColumnaImagen ? 3 : 2}" class="text-end fw-bold">Total opción ${opcion}:</td>
                <td class="text-end fw-bold">${formatoPeso(totalOpcion)}</td>
                ${mostrarColumnaImagen ? "<td></td>" : ""}
                <td></td>
            `;
            tbody.appendChild(trTotal);
        }
    });
}

function agruparPorOpcion(items) {
    return items.reduce((acc, item) => {
        const opcion = item.opcion || 1;
        if (!acc[opcion]) {
            acc[opcion] = [];
        }
        acc[opcion].push(item);
        return acc;
    }, {});
}

function calcularTotales() {
    const opciones = agruparPorOpcion(productos);
    const numeroOpciones = Object.keys(opciones).length;
    const totalesGenerales = document.getElementById("totalesGenerales");

    if (numeroOpciones > 1) {
        totalesGenerales.style.display = "none";
        return;
    }

    totalesGenerales.style.display = "block";

    const productosSinInstalacion = productos.filter(
        (producto) => !esProductoSinDescuento(producto)
    );

    const productosSinDescuento = productos.filter(
        (producto) => esProductoSinDescuento(producto)
    );

    const subtotalSinInstalacion = productosSinInstalacion.reduce((acc, producto) => acc + producto.subtotal, 0);
    const subtotalInstalacion = productosSinDescuento.reduce((acc, producto) => acc + producto.subtotal, 0);
    const valorDescuento = subtotalSinInstalacion * (descuentoGeneral / 100);
    const total = subtotalSinInstalacion - valorDescuento + subtotalInstalacion;

    document.getElementById("subtotal").innerText = formatoPeso(subtotalSinInstalacion + subtotalInstalacion);
    document.getElementById("descuentoValor").innerText = formatoPeso(valorDescuento);
    document.getElementById("totalGeneral").innerText = formatoPeso(total);

    const descuentoSection = document.getElementById("descuentoSection");
    if (descuentoGeneral > 0) {
        descuentoSection.classList.add("visible");
    } else {
        descuentoSection.classList.remove("visible");
    }
}

function actualizarSaludo() {
    const genero = document.getElementById("genero").value;
    const nombre = document.getElementById("cliente").value.trim();
    document.getElementById("saludoGenero").innerText = `${genero}:`;
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
