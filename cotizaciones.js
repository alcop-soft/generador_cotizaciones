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

function escaparHtml(texto) {
    return (texto || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function obtenerTituloProducto(producto) {
    return (producto.titulo || producto.descripcion || "").trim();
}

function obtenerSubtituloProducto(producto) {
    return (producto.subtitulo || "").trim();
}

function obtenerTextoProducto(producto) {
    return `${obtenerTituloProducto(producto)} ${obtenerSubtituloProducto(producto)}`.trim();
}

function esProductoInstalacion(producto) {
    return normalizarTexto(obtenerTextoProducto(producto)).includes("instalacion");
}

function esProductoSinDescuento(producto) {
    const descripcion = normalizarTexto(obtenerTextoProducto(producto));
    return descripcion.includes("instalacion") || descripcion.includes("mantenimiento");
}

let productos = [];
let descuentosPorOpcion = {};
let ivaActivo = false;
let tablaCounter = 1;
let productoEditandoId = null;
let editarInstalacionModal = null;
const UNIDAD_DEFAULT = "Unidades";
let notaConfirmada = false;
const VENDEDORES = {
    "Mateo Vanegas": "315 2762255",
    "Marina Arbelaez": "320 8940228",
    "Alba Arbelaez": "310 4692399",
    "Cesar Yovanny": "310 5385318",
    "Otro": "321 7719562"
};

function leerImagenProducto() {
    return leerImagenDesdeInput("imagenProducto");
}

function leerImagenDesdeInput(inputId) {
    const inputImagen = document.getElementById(inputId);
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

function toggleUnidadPersonalizada(selectEl, inputEl) {
    if (!selectEl || !inputEl) {
        return;
    }

    const esOtra = selectEl.value === "otra";
    inputEl.classList.toggle("d-none", !esOtra);
    if (!esOtra) {
        inputEl.value = "";
    }
}

function leerUnidadSeleccionada(selectId, inputId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) {
        return "";
    }

    if (selectEl.value === "otra") {
        const inputEl = document.getElementById(inputId);
        return inputEl ? inputEl.value.trim() : "";
    }

    return selectEl.value.trim();
}

function aplicarUnidadSeleccionada(selectId, inputId, unidad) {
    const selectEl = document.getElementById(selectId);
    const inputEl = document.getElementById(inputId);

    if (!selectEl || !inputEl) {
        return;
    }

    const opciones = Array.from(selectEl.options).map((option) => option.value);
    if (unidad && opciones.includes(unidad) && unidad !== "otra") {
        selectEl.value = unidad;
        inputEl.classList.add("d-none");
        inputEl.value = "";
        return;
    }

    selectEl.value = "otra";
    inputEl.classList.remove("d-none");
    inputEl.value = unidad || "";
}

function toggleVendedorOtro(selectEl, inputEl) {
    if (!selectEl || !inputEl) {
        return;
    }

    const esOtro = selectEl.value === "Otro";
    inputEl.classList.toggle("d-none", !esOtro);
    if (!esOtro) {
        inputEl.value = "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const fecha = new Date();
    const opcionesFecha = { day: "numeric", month: "long", year: "numeric" };
    const fechaFormateada = fecha.toLocaleDateString("es-CO", opcionesFecha);
    document.getElementById("fecha").innerText = `Pereira, ${fechaFormateada}`;

    document.getElementById("agregarProducto").addEventListener("click", agregarProducto);
    document.getElementById("generarPDF").addEventListener("click", () => window.print());
    document.getElementById("agregarTabla").addEventListener("click", agregarNuevaTabla);
    document.getElementById("genero").addEventListener("change", actualizarSaludo);
    document.getElementById("cliente").addEventListener("input", actualizarSaludo);
    document.getElementById("guardarEdicionInstalacion").addEventListener("click", guardarEdicionProducto);

    const unidadSelect = document.getElementById("unidadCantidad");
    const unidadPersonalizada = document.getElementById("unidadPersonalizada");
    if (unidadSelect && unidadPersonalizada) {
        unidadSelect.addEventListener("change", () => toggleUnidadPersonalizada(unidadSelect, unidadPersonalizada));
        toggleUnidadPersonalizada(unidadSelect, unidadPersonalizada);
    }

    const editarUnidadSelect = document.getElementById("editarUnidad");
    const editarUnidadPersonalizada = document.getElementById("editarUnidadPersonalizada");
    if (editarUnidadSelect && editarUnidadPersonalizada) {
        editarUnidadSelect.addEventListener("change", () => toggleUnidadPersonalizada(editarUnidadSelect, editarUnidadPersonalizada));
        toggleUnidadPersonalizada(editarUnidadSelect, editarUnidadPersonalizada);
    }

    const ivaCheckbox = document.getElementById("aplicarIva");
    if (ivaCheckbox) {
        ivaActivo = ivaCheckbox.checked;
        ivaCheckbox.addEventListener("change", aplicarIva);
    }

    const editarImagenProducto = document.getElementById("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    if (editarImagenProducto && quitarImagenEditar) {
        editarImagenProducto.addEventListener("change", () => {
            if (editarImagenProducto.files && editarImagenProducto.files.length > 0) {
                quitarImagenEditar.checked = false;
            }
        });
    }

    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    if (descuentoOpcionUnicaInput) {
        descuentoOpcionUnicaInput.addEventListener("change", aplicarDescuentoOpcionUnica);
    }

    const vendedorSelect = document.getElementById("vendedor");
    const vendedorOtroInput = document.getElementById("vendedorOtro");
    if (vendedorSelect) {
        vendedorSelect.addEventListener("change", () => {
            toggleVendedorOtro(vendedorSelect, vendedorOtroInput);
            actualizarNombreVendedor();
        });
        toggleVendedorOtro(vendedorSelect, vendedorOtroInput);
    }
    if (vendedorOtroInput) {
        vendedorOtroInput.addEventListener("input", actualizarNombreVendedor);
    }

    const notaRapidaInput = document.getElementById("notaRapidaInput");
    const agregarNotaBtn = document.getElementById("agregarNota");
    const eliminarNotaBtn = document.getElementById("eliminarNota");
    if (agregarNotaBtn) {
        agregarNotaBtn.addEventListener("click", () => {
            notaConfirmada = true;
            actualizarNotaRapida();
        });
    }
    if (eliminarNotaBtn) {
        eliminarNotaBtn.addEventListener("click", () => {
            notaConfirmada = false;
            if (notaRapidaInput) {
                notaRapidaInput.value = "";
            }
            actualizarNotaRapida();
        });
    }

    if (window.bootstrap) {
        const modalElement = document.getElementById("editarInstalacionModal");
        editarInstalacionModal = new window.bootstrap.Modal(modalElement);
    }

    actualizarSaludo();
    actualizarNombreVendedor();
    actualizarNotaRapida();
    renderizarTabla();
    calcularTotales();
});

async function agregarProducto() {
    const cliente = document.getElementById("cliente").value.trim();
    const titulo = document.getElementById("producto").value.trim();
    const subtitulo = document.getElementById("productoDescripcion").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("cantidad").value);
    const precio = Number.parseFloat(document.getElementById("precio").value);
    const unidad = leerUnidadSeleccionada("unidadCantidad", "unidadPersonalizada");
    const imagen = await leerImagenProducto();

    if (!titulo || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete producto, cantidad y precio con valores válidos.");
        return;
    }

    if (!unidad) {
        alert("Indique la unidad de medida para la cantidad.");
        return;
    }

    const subtotal = cantidad * precio;

    productos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        titulo,
        subtitulo,
        descripcion: titulo,
        cantidad,
        unidad,
        precio,
        subtotal,
        imagen,
        opcion: tablaCounter
    });

    document.getElementById("nombreCliente").innerText = cliente;
    renderizarTabla();
    calcularTotales();

    document.getElementById("producto").value = "";
    document.getElementById("productoDescripcion").value = "";
    document.getElementById("cantidad").value = "";
    document.getElementById("precio").value = "";
    document.getElementById("imagenProducto").value = "";
    const unidadSelect = document.getElementById("unidadCantidad");
    const unidadPersonalizada = document.getElementById("unidadPersonalizada");
    if (unidadSelect) {
        unidadSelect.value = UNIDAD_DEFAULT;
    }
    if (unidadPersonalizada) {
        unidadPersonalizada.value = "";
        unidadPersonalizada.classList.add("d-none");
    }
}

function obtenerDescuentoOpcion(opcion) {
    const key = String(opcion);
    const descuento = Number.parseFloat(descuentosPorOpcion[key]);
    if (!Number.isFinite(descuento)) {
        return 0;
    }

    return Math.max(0, Math.min(100, descuento));
}

function actualizarDescuentoOpcion(opcion, valor) {
    const key = String(opcion);
    const descuento = Number.parseFloat(valor);
    descuentosPorOpcion[key] = Number.isFinite(descuento) ? Math.max(0, Math.min(100, descuento)) : 0;
    renderizarTabla();
    calcularTotales();
}

function aplicarDescuentoOpcionUnica() {
    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    const opciones = agruparPorOpcion(productos);
    const opcion = Object.keys(opciones)[0] || String(tablaCounter || 1);
    const valor = descuentoOpcionUnicaInput ? descuentoOpcionUnicaInput.value : 0;
    actualizarDescuentoOpcion(opcion, valor);
}

function estaIvaAplicado() {
    const ivaCheckbox = document.getElementById("aplicarIva");
    return ivaCheckbox ? ivaCheckbox.checked : ivaActivo;
}

function calcularResumenOpcion(productosOpcion, opcion, aplicarIvaFlag = false) {
    const productosConDescuento = productosOpcion.filter(
        (producto) => !esProductoSinDescuento(producto)
    );
    const productosSinDescuento = productosOpcion.filter(
        (producto) => esProductoSinDescuento(producto)
    );

    const subtotalConDescuento = productosConDescuento.reduce((acc, producto) => acc + producto.subtotal, 0);
    const subtotalSinDescuento = productosSinDescuento.reduce((acc, producto) => acc + producto.subtotal, 0);
    const subtotal = subtotalConDescuento + subtotalSinDescuento;
    const descuentoPorcentaje = obtenerDescuentoOpcion(opcion);
    const valorDescuento = subtotalConDescuento * (descuentoPorcentaje / 100);
    const totalSinIva = subtotalConDescuento - valorDescuento + subtotalSinDescuento;
    const valorIva = aplicarIvaFlag ? totalSinIva * 0.19 : 0;
    const total = totalSinIva + valorIva;

    return {
        subtotal,
        descuentoPorcentaje,
        valorDescuento,
        valorIva,
        totalSinIva,
        total
    };
}

function aplicarIva() {
    const ivaCheckbox = document.getElementById("aplicarIva");
    ivaActivo = ivaCheckbox ? ivaCheckbox.checked : false;
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
    document.getElementById("editarTitulo").value = obtenerTituloProducto(producto);
    document.getElementById("editarSubtitulo").value = obtenerSubtituloProducto(producto);
    document.getElementById("editarCantidad").value = producto.cantidad;
    aplicarUnidadSeleccionada("editarUnidad", "editarUnidadPersonalizada", producto.unidad);
    document.getElementById("editarPrecio").value = producto.precio;
    const editarImagenProducto = document.getElementById("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    if (editarImagenProducto) {
        editarImagenProducto.value = "";
    }
    if (quitarImagenEditar) {
        quitarImagenEditar.checked = false;
    }

    if (editarInstalacionModal) {
        editarInstalacionModal.show();
    }
}

async function guardarEdicionProducto() {
    if (productoEditandoId === null) {
        return;
    }

    const titulo = document.getElementById("editarTitulo").value.trim();
    const subtitulo = document.getElementById("editarSubtitulo").value.trim();
    const cantidad = Number.parseFloat(document.getElementById("editarCantidad").value);
    const precio = Number.parseFloat(document.getElementById("editarPrecio").value);
    const unidad = leerUnidadSeleccionada("editarUnidad", "editarUnidadPersonalizada");

    if (!titulo || !Number.isFinite(cantidad) || !Number.isFinite(precio) || cantidad <= 0 || precio <= 0) {
        alert("Complete producto, cantidad y precio con valores válidos.");
        return;
    }

    if (!unidad) {
        alert("Indique la unidad de medida para la cantidad.");
        return;
    }

    const indice = productos.findIndex((item) => item.id === productoEditandoId);
    if (indice === -1) {
        return;
    }

    const nuevaImagen = await leerImagenDesdeInput("editarImagenProducto");
    const quitarImagenEditar = document.getElementById("quitarImagenEditar");
    const quitarImagen = quitarImagenEditar ? quitarImagenEditar.checked : false;
    let imagenFinal = productos[indice].imagen || "";
    if (nuevaImagen) {
        imagenFinal = nuevaImagen;
    } else if (quitarImagen) {
        imagenFinal = "";
    }

    productos[indice].titulo = titulo;
    productos[indice].subtitulo = subtitulo;
    productos[indice].descripcion = titulo;
    productos[indice].cantidad = cantidad;
    productos[indice].unidad = unidad;
    productos[indice].precio = precio;
    productos[indice].subtotal = cantidad * precio;
    productos[indice].imagen = imagenFinal;

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
    const aplicarIvaFlag = estaIvaAplicado();
    llaves.forEach((opcion) => {
        const productosOpcion = opciones[opcion];
        const resumenOpcion = calcularResumenOpcion(productosOpcion, opcion, aplicarIvaFlag);
        if (numeroOpciones > 1) {
            const trHeader = document.createElement("tr");
            trHeader.innerHTML = `
                <td colspan="${mostrarColumnaImagen ? 6 : 5}" class="opcion-header-cell">
                    <div class="d-flex flex-column flex-md-row gap-2 align-items-md-center justify-content-between">
                        <span class="fw-bold">OPCIÓN ${opcion}</span>
                        <div class="d-flex flex-column flex-sm-row align-items-sm-center gap-2">
                            <div class="input-group input-group-sm no-print descuento-opcion-control">
                                <span class="input-group-text">Descuento %</span>
                                <input
                                    type="number"
                                    class="form-control"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value="${resumenOpcion.descuentoPorcentaje}"
                                    onchange="actualizarDescuentoOpcion(${opcion}, this.value)"
                                >
                            </div>
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(trHeader);
        }

        productosOpcion.forEach((producto) => {
            const tr = document.createElement("tr");
            const tituloProducto = obtenerTituloProducto(producto);
            const subtituloProducto = obtenerSubtituloProducto(producto);
            const tituloSeguro = escaparHtml(tituloProducto);
            const subtituloSeguro = escaparHtml(subtituloProducto);
            const descripcionCelda = subtituloSeguro
                ? `
                    <div class="descripcion-producto">
                        <div class="descripcion-producto-titulo">${tituloSeguro}</div>
                        <div class="descripcion-producto-subtitulo">${subtituloSeguro}</div>
                    </div>
                `
                : `
                    <div class="descripcion-producto">
                        <div class="descripcion-producto-titulo">${tituloSeguro}</div>
                    </div>
                `;
            const imagenCelda = producto.imagen
                ? `<img src="${producto.imagen}" alt="Imagen de ${tituloSeguro || "producto"}" class="producto-img">`
                : '<span class="text-muted">Sin imagen</span>';
            const unidadTexto = producto.unidad ? ` ${producto.unidad}` : "";
            const botonEditar = `
                <button class="btn btn-sm btn-primary me-1" onclick="abrirModalEdicion(${producto.id})">
                    <i class="bi bi-pencil-square"></i> Editar
                </button>
            `;

            tr.innerHTML = `
                <td>${descripcionCelda}</td>
                <td class="text-center">${formatoNumero(producto.cantidad)}${unidadTexto}</td>
                <td class="text-end">${formatoPeso(producto.precio)}</td>
                <td class="text-end">${formatoPeso(producto.subtotal)}</td>
                ${mostrarColumnaImagen ? `<td class="text-center columna-imagen-celda">${imagenCelda}</td>` : ""}
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
            const mostrarDetalle = resumenOpcion.valorDescuento > 0 || resumenOpcion.valorIva > 0;
            const resumenPills = [];
            if (mostrarDetalle) {
                resumenPills.push(`<span class="opcion-pill">Subtotal: ${formatoPeso(resumenOpcion.subtotal)}</span>`);
            }
            if (resumenOpcion.valorDescuento > 0) {
                resumenPills.push(`<span class="opcion-pill opcion-pill-danger">Desc. ${formatoNumero(resumenOpcion.descuentoPorcentaje)}%: -${formatoPeso(resumenOpcion.valorDescuento)}</span>`);
            }
            if (resumenOpcion.valorIva > 0) {
                resumenPills.push(`<span class="opcion-pill opcion-pill-iva">IVA 19%: +${formatoPeso(resumenOpcion.valorIva)}</span>`);
            }
            const resumenPillsHtml = resumenPills.length > 0
                ? `<div class="opcion-resumen-inline">${resumenPills.join("")}</div>`
                : "";
            const trResumen = document.createElement("tr");
            trResumen.className = "opcion-resumen-row";
            trResumen.innerHTML = `
                <td colspan="3" class="text-end">${resumenPillsHtml}</td>
                <td class="text-end fw-bold">${aplicarIvaFlag ? "Total + IVA" : "Total"}: ${formatoPeso(resumenOpcion.total)}</td>
                ${mostrarColumnaImagen ? "<td></td>" : ""}
                <td></td>
            `;
            tbody.appendChild(trResumen);
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
    if (!totalesGenerales) {
        return;
    }

    if (numeroOpciones > 1) {
        totalesGenerales.style.display = "none";
        return;
    }

    totalesGenerales.style.display = "block";
    const opcionUnica = Object.keys(opciones)[0] || "1";
    const aplicarIvaFlag = estaIvaAplicado();
    const resumen = calcularResumenOpcion(opciones[opcionUnica] || [], opcionUnica, aplicarIvaFlag);
    const valorDescuento = resumen.valorDescuento;
    const valorIva = resumen.valorIva;
    const total = resumen.total;

    document.getElementById("subtotal").innerText = formatoPeso(resumen.subtotal);
    document.getElementById("descuentoValor").innerText = formatoPeso(valorDescuento);
    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    if (descuentoOpcionUnicaInput) {
        descuentoOpcionUnicaInput.value = resumen.descuentoPorcentaje;
    }
    const ivaValor = document.getElementById("ivaValor");
    if (ivaValor) {
        ivaValor.innerText = formatoPeso(valorIva);
    }
    document.getElementById("totalGeneral").innerText = formatoPeso(total);

    const descuentoSection = document.getElementById("descuentoSection");
    if (valorDescuento > 0) {
        descuentoSection.classList.add("visible");
    } else {
        descuentoSection.classList.remove("visible");
    }

    const ivaSection = document.getElementById("ivaSection");
    if (ivaSection) {
        if (aplicarIvaFlag) {
            ivaSection.classList.add("visible");
        } else {
            ivaSection.classList.remove("visible");
        }
    }
}

function actualizarSaludo() {
    const genero = document.getElementById("genero").value;
    const nombre = document.getElementById("cliente").value.trim();
    document.getElementById("saludoGenero").innerText = `${genero}:`;
    document.getElementById("nombreCliente").innerText = nombre;
}

function actualizarNombreVendedor() {
    const nombreVendedor = document.getElementById("nombreVendedor");
    const telefonoVendedor = document.getElementById("telefonoVendedor");

    if (!nombreVendedor) {
        return;
    }

    const vendedorSelect = document.getElementById("vendedor");
    const vendedorOtroInput = document.getElementById("vendedorOtro");
    const seleccionado = vendedorSelect ? vendedorSelect.value.trim() : "";
    const esOtro = seleccionado === "Otro";
    const nombreOtro = vendedorOtroInput ? vendedorOtroInput.value.trim() : "";
    const nombre = esOtro ? nombreOtro : seleccionado;
    nombreVendedor.innerText = nombre || "ALCOP.";

    if (telefonoVendedor) {
        const telefono = seleccionado ? (VENDEDORES[seleccionado] || "") : "";
        telefonoVendedor.innerText = telefono;
    }
}

function actualizarNotaRapida() {
    const notaInput = document.getElementById("notaRapidaInput");
    const notaTexto = document.getElementById("notaRapidaTexto");
    const notaCard = document.getElementById("notaRapidaCard");

    if (!notaTexto) {
        return;
    }

    const texto = notaInput ? notaInput.value.trim() : "";
    const mostrarNota = notaConfirmada && texto.length > 0;

    if (notaCard) {
        notaCard.classList.toggle("d-none", !mostrarNota);
    }

    notaTexto.innerText = mostrarNota ? texto : "";
}
