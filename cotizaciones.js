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

const IVA_RATE = 0.19;

function normalizarNumero(valor) {
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) ? numero : 0;
}

function redondearMoneda(valor) {
    return Math.round(normalizarNumero(valor) + Number.EPSILON);
}

function calcularSubtotal(cantidad, precio) {
    return redondearMoneda(normalizarNumero(cantidad) * normalizarNumero(precio));
}

function obtenerSubtotalProducto(producto) {
    if (!producto) {
        return 0;
    }

    if (Number.isFinite(producto.subtotal)) {
        return redondearMoneda(producto.subtotal);
    }

    return calcularSubtotal(producto.cantidad, producto.precio);
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

function esProductoSinDescuento(producto) {
    const descripcion = normalizarTexto(obtenerTextoProducto(producto));
    return descripcion.includes("instalacion") || descripcion.includes("mantenimiento");
}

let productos = [];
let descuentosPorOpcion = {};
let ivaPorOpcion = {};
let titulosPorOpcion = {};
let opcionActual = 1;
let ultimaOpcionCreada = 1;
const opcionesCreadas = new Set([1]);
let productoEditandoId = null;
let editarInstalacionModal = null;
let exportacionEnCurso = false;
let guardandoEdicion = false;
const UNIDAD_DEFAULT = "Unidades";
let notaConfirmada = false;
let notaImagen = "";
const VENDEDORES = {
    "Mateo Vanegas": "315 2762255",
    "Marina Arbelaez": "320 8940228",
    "Alba Arbelaez": "310 4692399",
    "Cesar Yovanny Franklin": "310 5385318",
    "Tania Jaramillo": "321 7719562",
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

async function confirmarNotaRapida() {
    notaConfirmada = true;
    notaImagen = await leerImagenDesdeInput("notaRapidaImagen");
    actualizarNotaRapida();
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

function obtenerOpcionesDisponibles() {
    const opciones = new Set(opcionesCreadas);
    productos.forEach((producto) => {
        const opcion = Number.parseInt(producto.opcion, 10);
        if (Number.isFinite(opcion) && opcion > 0) {
            opciones.add(opcion);
        }
    });

    return Array.from(opciones)
        .filter((opcion) => Number.isFinite(opcion) && opcion > 0)
        .sort((a, b) => a - b);
}

function obtenerTituloOpcion(opcion) {
    return obtenerTituloPersonalizadoOpcion(opcion);
}

function obtenerEtiquetaOpcion(opcion) {
    return `Opción ${opcion}`;
}

function obtenerTituloPersonalizadoOpcion(opcion) {
    const key = String(opcion);
    return (titulosPorOpcion[key] || "").trim();
}

function actualizarTituloOpcion(opcion, valor) {
    const key = String(opcion);
    const titulo = (valor || "").trim();
    if (titulo) {
        titulosPorOpcion[key] = titulo;
    } else {
        delete titulosPorOpcion[key];
    }
    sincronizarOpcionesDisponibles();
    sincronizarInputTituloOpcion();
    refrescarCotizacion();
}

function sincronizarInputTituloOpcion() {
    const opcionActivaSelect = document.getElementById("opcionActiva");
    const opcionTituloActualInput = document.getElementById("opcionTituloActual");
    if (!opcionActivaSelect || !opcionTituloActualInput) {
        return;
    }

    const opcionSeleccionada = opcionActivaSelect.value;
    opcionTituloActualInput.value = opcionSeleccionada
        ? obtenerTituloPersonalizadoOpcion(opcionSeleccionada)
        : "";
}

function sincronizarOpcionesDisponibles() {
    const opcionActivaSelect = document.getElementById("opcionActiva");
    const opciones = obtenerOpcionesDisponibles();
    const opcionMayor = opciones.length > 0 ? opciones[opciones.length - 1] : 1;
    if (opcionMayor > ultimaOpcionCreada) {
        ultimaOpcionCreada = opcionMayor;
    }

    if (!opciones.includes(opcionActual)) {
        opcionActual = opciones[0] || 1;
    }

    if (!opcionActivaSelect) {
        return;
    }

    opcionActivaSelect.innerHTML = opciones
        .map((opcion) => `<option value="${opcion}">${escaparHtml(obtenerEtiquetaOpcion(opcion))}</option>`)
        .join("");

    opcionActivaSelect.value = String(opcionActual);
    sincronizarInputTituloOpcion();
}

function refrescarCotizacion() {
    renderizarTabla();
    calcularTotales();
}

function esperarSiguienteFrame() {
    return new Promise((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

function esperarConTimeout(promesa, timeoutMs = 4000) {
    return new Promise((resolve) => {
        let resuelto = false;
        const timeoutId = window.setTimeout(() => {
            if (resuelto) {
                return;
            }
            resuelto = true;
            resolve();
        }, timeoutMs);

        Promise.resolve(promesa)
            .catch(() => {})
            .finally(() => {
                if (resuelto) {
                    return;
                }
                resuelto = true;
                window.clearTimeout(timeoutId);
                resolve();
            });
    });
}

async function esperarImagenesCotizacion() {
    const contenedor = document.querySelector(".cotizacion-container");
    if (!contenedor) {
        return;
    }

    const imagenes = Array.from(contenedor.querySelectorAll("img"));
    if (!imagenes.length) {
        await esperarSiguienteFrame();
        return;
    }

    await Promise.all(imagenes.map(async (img) => {
        if (!img.complete || img.naturalWidth === 0) {
            await esperarConTimeout(new Promise((resolve) => {
                const resolver = () => resolve();
                img.addEventListener("load", resolver, { once: true });
                img.addEventListener("error", resolver, { once: true });
            }), 4000);
        }

        if (typeof img.decode === "function") {
            await esperarConTimeout(img.decode(), 2500);
        }
    }));

    await esperarSiguienteFrame();
    await esperarSiguienteFrame();
}

async function prepararExportacionPDF() {
    sincronizarOpcionesDisponibles();
    refrescarCotizacion();
    await esperarImagenesCotizacion();
    optimizarSaltosPaginaOpciones();
}

function limpiarExportacionPDF() {
    limpiarSaltosPaginaOpciones();
}

function finalizarExportacionPDF() {
    limpiarExportacionPDF();
    exportacionEnCurso = false;
    const botonExportar = document.getElementById("generarPDF");
    if (botonExportar) {
        botonExportar.disabled = false;
    }
}

async function exportarPDF() {
    if (exportacionEnCurso) {
        return;
    }

    exportacionEnCurso = true;
    const botonExportar = document.getElementById("generarPDF");
    if (botonExportar) {
        botonExportar.disabled = true;
    }

    try {
        await prepararExportacionPDF();
    } catch (error) {
        console.error("No se pudo preparar la exportacion:", error);
        finalizarExportacionPDF();
        alert("No fue posible preparar la exportación.");
        return;
    }

    try {
        window.print();
    } catch (error) {
        console.error("No se pudo abrir la impresión:", error);
        finalizarExportacionPDF();
        alert("No fue posible abrir la vista de impresión.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const fecha = new Date();
    const opcionesFecha = { day: "numeric", month: "long", year: "numeric" };
    const fechaFormateada = fecha.toLocaleDateString("es-CO", opcionesFecha);
    document.getElementById("fecha").innerText = `Pereira, ${fechaFormateada}`;

    document.getElementById("agregarProducto").addEventListener("click", agregarProducto);
    document.getElementById("generarPDF").addEventListener("click", exportarPDF);
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

    const ivaOpcionUnicaCheckbox = document.getElementById("aplicarIvaOpcionUnica");
    if (ivaOpcionUnicaCheckbox) {
        ivaOpcionUnicaCheckbox.addEventListener("change", aplicarIvaOpcionUnica);
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
    const notaRapidaImagenInput = document.getElementById("notaRapidaImagen");
    const agregarNotaBtn = document.getElementById("agregarNota");
    const eliminarNotaBtn = document.getElementById("eliminarNota");
    if (agregarNotaBtn) {
        agregarNotaBtn.addEventListener("click", async () => {
            await confirmarNotaRapida();
        });
    }
    if (notaRapidaImagenInput) {
        notaRapidaImagenInput.addEventListener("change", async () => {
            if (notaConfirmada) {
                await confirmarNotaRapida();
            }
        });
    }
    if (eliminarNotaBtn) {
        eliminarNotaBtn.addEventListener("click", () => {
            notaConfirmada = false;
            notaImagen = "";
            if (notaRapidaInput) {
                notaRapidaInput.value = "";
            }
            if (notaRapidaImagenInput) {
                notaRapidaImagenInput.value = "";
            }
            actualizarNotaRapida();
        });
    }

    if (window.bootstrap) {
        const modalElement = document.getElementById("editarInstalacionModal");
        editarInstalacionModal = new window.bootstrap.Modal(modalElement);
        if (modalElement) {
            modalElement.addEventListener("hidden.bs.modal", () => {
                productoEditandoId = null;
                guardandoEdicion = false;
                const guardarBtn = document.getElementById("guardarEdicionInstalacion");
                if (guardarBtn) {
                    guardarBtn.disabled = false;
                }
            });
        }
    }

    const opcionActivaSelect = document.getElementById("opcionActiva");
    const opcionTituloActualInput = document.getElementById("opcionTituloActual");
    if (opcionActivaSelect) {
        opcionActivaSelect.addEventListener("change", () => {
            const opcionSeleccionada = Number.parseInt(opcionActivaSelect.value, 10);
            if (Number.isFinite(opcionSeleccionada) && opcionSeleccionada > 0) {
                opcionActual = opcionSeleccionada;
            }
            sincronizarInputTituloOpcion();
        });
    }
    if (opcionTituloActualInput) {
        opcionTituloActualInput.addEventListener("input", () => {
            const opcionSeleccionada = opcionActivaSelect ? opcionActivaSelect.value : "";
            if (!opcionSeleccionada) {
                return;
            }
            actualizarTituloOpcion(opcionSeleccionada, opcionTituloActualInput.value);
        });
    }

    sincronizarOpcionesDisponibles();
    actualizarSaludo();
    actualizarNombreVendedor();
    actualizarNotaRapida();
    refrescarCotizacion();

    window.addEventListener("beforeprint", () => {
        if (exportacionEnCurso) {
            return;
        }

        prepararExportacionPDF().catch((error) => {
            console.error("No se pudo preparar la impresion:", error);
        });
    });
    window.addEventListener("afterprint", finalizarExportacionPDF);
    window.addEventListener("focus", () => {
        if (exportacionEnCurso) {
            window.setTimeout(finalizarExportacionPDF, 300);
        }
    });
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

    const subtotal = calcularSubtotal(cantidad, precio);

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
        opcion: opcionActual
    });
    opcionesCreadas.add(opcionActual);

    document.getElementById("nombreCliente").innerText = cliente;
    refrescarCotizacion();

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
    refrescarCotizacion();
}

function aplicarDescuentoOpcionUnica() {
    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    const opciones = agruparPorOpcion(productos);
    const opcion = Object.keys(opciones)[0] || String(opcionActual || 1);
    const valor = descuentoOpcionUnicaInput ? descuentoOpcionUnicaInput.value : 0;
    actualizarDescuentoOpcion(opcion, valor);
}

function estaIvaAplicadoOpcion(opcion) {
    const key = String(opcion);
    return Boolean(ivaPorOpcion[key]);
}

function actualizarIvaOpcion(opcion, aplicar) {
    const key = String(opcion);
    ivaPorOpcion[key] = Boolean(aplicar);
    refrescarCotizacion();
}

function aplicarIvaOpcionUnica() {
    const ivaOpcionUnicaCheckbox = document.getElementById("aplicarIvaOpcionUnica");
    const opciones = agruparPorOpcion(productos);
    const opcion = Object.keys(opciones)[0] || String(opcionActual || 1);
    actualizarIvaOpcion(opcion, ivaOpcionUnicaCheckbox ? ivaOpcionUnicaCheckbox.checked : false);
}

function calcularResumenOpcion(productosOpcion, opcion) {
    const productosConDescuento = productosOpcion.filter(
        (producto) => !esProductoSinDescuento(producto)
    );
    const productosSinDescuento = productosOpcion.filter(
        (producto) => esProductoSinDescuento(producto)
    );

    const subtotalConDescuento = productosConDescuento.reduce((acc, producto) => acc + obtenerSubtotalProducto(producto), 0);
    const subtotalSinDescuento = productosSinDescuento.reduce((acc, producto) => acc + obtenerSubtotalProducto(producto), 0);
    const subtotal = redondearMoneda(subtotalConDescuento + subtotalSinDescuento);
    const descuentoPorcentaje = obtenerDescuentoOpcion(opcion);
    const valorDescuento = redondearMoneda(subtotalConDescuento * (descuentoPorcentaje / 100));
    const totalSinIva = redondearMoneda((subtotalConDescuento - valorDescuento) + subtotalSinDescuento);
    const ivaAplicado = estaIvaAplicadoOpcion(opcion);
    const valorIva = ivaAplicado ? redondearMoneda(totalSinIva * IVA_RATE) : 0;
    const total = redondearMoneda(totalSinIva + valorIva);

    return {
        subtotal,
        descuentoPorcentaje,
        valorDescuento,
        ivaAplicado,
        valorIva,
        totalSinIva,
        total
    };
}

function eliminarProducto(id) {
    productos = productos.filter((producto) => producto.id !== id);
    refrescarCotizacion();
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
    if (productoEditandoId === null || guardandoEdicion) {
        return;
    }

    const guardarBtn = document.getElementById("guardarEdicionInstalacion");
    guardandoEdicion = true;
    if (guardarBtn) {
        guardarBtn.disabled = true;
    }

    try {
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
            alert("No se encontró el producto que se estaba editando.");
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
        productos[indice].subtotal = calcularSubtotal(cantidad, precio);
        productos[indice].imagen = imagenFinal;

        refrescarCotizacion();

        if (editarInstalacionModal) {
            editarInstalacionModal.hide();
        }

        productoEditandoId = null;
    } catch (error) {
        console.error("No se pudo guardar la edición del producto:", error);
        alert("Ocurrió un error al guardar los cambios.");
    } finally {
        guardandoEdicion = false;
        if (guardarBtn) {
            guardarBtn.disabled = false;
        }
    }
}

function agregarNuevaTabla() {
    ultimaOpcionCreada += 1;
    opcionActual = ultimaOpcionCreada;
    opcionesCreadas.add(opcionActual);
    sincronizarOpcionesDisponibles();
    alert(`Nueva opción ${opcionActual} creada. Los siguientes productos pertenecerán a esta opción.`);
}

function obtenerEncabezadoTablaHtml(mostrarColumnaImagen) {
    return `
        <thead>
            <tr>
                <th>DESCRIPCIÓN</th>
                <th>CANT.</th>
                <th>P. UNIT.</th>
                <th>SUBTOTAL</th>
                ${mostrarColumnaImagen ? '<th class="columna-imagen-header">IMAGEN</th>' : ""}
                <th>ACCIONES</th>
            </tr>
        </thead>
    `;
}

function obtenerFilaEncabezadoOpcionHtml(opcion, resumenOpcion, mostrarColumnaImagen) {
    const totalColumnas = mostrarColumnaImagen ? 6 : 5;

    return `
        <tr class="no-print">
            <td colspan="${totalColumnas}" class="opcion-header-cell">
                <div class="opcion-header-screen d-flex flex-column flex-md-row gap-2 align-items-md-center justify-content-between">
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
                        <div class="form-check no-print">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                id="ivaOpcion${opcion}"
                                ${resumenOpcion.ivaAplicado ? "checked" : ""}
                                onchange="actualizarIvaOpcion(${opcion}, this.checked)"
                            >
                            <label class="form-check-label small" for="ivaOpcion${opcion}">
                                Aplicar IVA 19%
                            </label>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

function obtenerFilaProductoHtml(producto, mostrarColumnaImagen) {
    const subtotalProducto = obtenerSubtotalProducto(producto);
    producto.subtotal = subtotalProducto;
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
    const unidadTexto = producto.unidad ? ` ${escaparHtml(producto.unidad)}` : "";
    const botonEditar = `
        <button class="btn btn-sm btn-primary me-1" onclick="abrirModalEdicion(${producto.id})">
            <i class="bi bi-pencil-square"></i> Editar
        </button>
    `;

    return `
        <tr>
            <td>${descripcionCelda}</td>
            <td class="text-center">${formatoNumero(producto.cantidad)}${unidadTexto}</td>
            <td class="text-end">${formatoPeso(producto.precio)}</td>
            <td class="text-end">${formatoPeso(subtotalProducto)}</td>
            ${mostrarColumnaImagen ? `<td class="text-center columna-imagen-celda">${imagenCelda}</td>` : ""}
            <td class="text-center">
                ${botonEditar}
                <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${producto.id})">
                    <i class="bi bi-trash"></i> Eliminar
                </button>
            </td>
        </tr>
    `;
}

function obtenerFilaResumenOpcionHtml(resumenOpcion, mostrarColumnaImagen) {
    const mostrarDetalle = resumenOpcion.valorDescuento > 0 || resumenOpcion.valorIva > 0;
    const resumenPills = [];
    if (mostrarDetalle) {
        resumenPills.push(`
            <div class="opcion-resumen-card">
                <span class="opcion-resumen-card-label">Subtotal</span>
                <span class="opcion-resumen-card-value">${formatoPeso(resumenOpcion.subtotal)}</span>
            </div>
        `);
    }
    if (resumenOpcion.valorDescuento > 0) {
        resumenPills.push(`
            <div class="opcion-resumen-card opcion-resumen-card-descuento">
                <span class="opcion-resumen-card-label">Descuento ${formatoNumero(resumenOpcion.descuentoPorcentaje)}%</span>
                <span class="opcion-resumen-card-value">Ahorro: -${formatoPeso(resumenOpcion.valorDescuento)}</span>
            </div>
        `);
    }
    if (resumenOpcion.valorIva > 0) {
        resumenPills.push(`
            <div class="opcion-resumen-card opcion-resumen-card-iva">
                <span class="opcion-resumen-card-label">IVA 19%</span>
                <span class="opcion-resumen-card-value">+${formatoPeso(resumenOpcion.valorIva)}</span>
            </div>
        `);
    }
    const resumenPillsHtml = resumenPills.length > 0
        ? `<div class="opcion-resumen-inline">${resumenPills.join("")}</div>`
        : "";

    return `
        <tr class="opcion-resumen-row">
            <td colspan="3" class="text-end">${resumenPillsHtml}</td>
            <td class="text-end fw-bold">${resumenOpcion.ivaAplicado ? "Total + IVA" : "Total"}: ${formatoPeso(resumenOpcion.total)}</td>
            ${mostrarColumnaImagen ? "<td></td>" : ""}
            <td></td>
        </tr>
    `;
}

function obtenerTablaVaciaHtml(mostrarColumnaImagen) {
    const totalColumnas = mostrarColumnaImagen ? 6 : 5;
    return `
        <section class="opcion-bloque">
            <table class="table table-bordered tabla-cotizacion">
                ${obtenerEncabezadoTablaHtml(mostrarColumnaImagen)}
                <tbody>
                    <tr>
                        <td colspan="${totalColumnas}" class="text-center text-muted">No hay productos agregados</td>
                    </tr>
                </tbody>
            </table>
        </section>
    `;
}

function obtenerAlturaPaginaImpresionPx() {
    const MM_TO_PX = 96 / 25.4;
    const ALTO_PAGINA_DISPONIBLE_MM = 297 - 24;
    return ALTO_PAGINA_DISPONIBLE_MM * MM_TO_PX;
}

function obtenerAnchoContenidoImpresionPx(contenedor) {
    const MM_TO_PX = 96 / 25.4;
    const ANCHO_PAGINA_DISPONIBLE_MM = 210 - 20;
    const anchoPaginaPx = ANCHO_PAGINA_DISPONIBLE_MM * MM_TO_PX;
    const contenedorImpresion = contenedor.closest(".cotizacion-container");

    if (!contenedorImpresion) {
        return anchoPaginaPx;
    }

    const estilos = window.getComputedStyle(contenedorImpresion);
    const paddingLeftPrintPx = 88;
    const paddingRightPx = Number.parseFloat(estilos.paddingRight) || 0;
    return Math.max(240, anchoPaginaPx - paddingLeftPrintPx - paddingRightPx);
}

function crearMedidorFragmentos(widthPx) {
    const medidor = document.createElement("div");
    medidor.className = "medidor-exportacion-pdf";
    medidor.style.position = "absolute";
    medidor.style.left = "-100000px";
    medidor.style.top = "0";
    medidor.style.visibility = "hidden";
    medidor.style.width = `${Math.ceil(widthPx)}px`;
    medidor.style.display = "flow-root";
    document.body.appendChild(medidor);
    return medidor;
}

function construirHtmlFragmentoOpcion({ tituloHtml, theadHtml, rowsHtml, saltoPagina }) {
    return `
        <section class="opcion-bloque${saltoPagina ? " opcion-bloque-salto" : ""}">
            ${tituloHtml || ""}
            <table class="table table-bordered tabla-cotizacion">
                ${theadHtml}
                <tbody>
                    ${rowsHtml.join("")}
                </tbody>
            </table>
        </section>
    `;
}

function medirHtmlFragmento(medidor, config) {
    medidor.innerHTML = construirHtmlFragmentoOpcion({ ...config, saltoPagina: false });
    const fragmento = medidor.firstElementChild;
    return fragmento ? fragmento.getBoundingClientRect().height : 0;
}

function obtenerFilasImprimiblesOpcion(bloque) {
    const tabla = bloque.querySelector("table.tabla-cotizacion");
    if (!tabla) {
        return null;
    }

    const titulo = bloque.querySelector(":scope > .opcion-header-title");
    const thead = tabla.querySelector("thead");
    const filas = Array.from(tabla.querySelectorAll("tbody tr"));
    const filasItems = filas
        .filter((fila) => !fila.classList.contains("no-print") && !fila.classList.contains("opcion-resumen-row"))
        .map((fila) => ({
            tipo: "item",
            html: fila.outerHTML
        }));
    const filaResumen = filas.find((fila) => fila.classList.contains("opcion-resumen-row"));

    return {
        tituloHtml: titulo ? titulo.outerHTML : "",
        theadHtml: thead ? thead.outerHTML : "",
        filasItems,
        filaResumen: filaResumen
            ? {
                tipo: "resumen",
                html: filaResumen.outerHTML
            }
            : null
    };
}

function calcularEspacioDisponiblePrimeraPagina(contenedor, altoPaginaPx) {
    const contenedorImpresion = contenedor.closest(".cotizacion-container") || contenedor.parentElement;
    if (!contenedorImpresion) {
        return altoPaginaPx;
    }

    const rectContenedorImpresion = contenedorImpresion.getBoundingClientRect();
    const inicioContenidoRelativo = contenedor.getBoundingClientRect().top - rectContenedorImpresion.top;
    const espacioDisponible = altoPaginaPx - inicioContenidoRelativo;

    if (espacioDisponible <= 0 || espacioDisponible > altoPaginaPx) {
        return altoPaginaPx;
    }

    return espacioDisponible;
}

function paginarFilasOpcion(datosOpcion, espacioDisponibleInicial, altoPaginaPx, medidor) {
    const MARGEN_SEGURIDAD_PX = 4;
    const TOLERANCIA_RESUMEN_PX = 90;
    const fragmentos = [];
    const filasPendientes = [...datosOpcion.filasItems];
    if (datosOpcion.filaResumen) {
        filasPendientes.push(datosOpcion.filaResumen);
    }

    let espacioDisponible = espacioDisponibleInicial;
    let filasFragmento = [];
    let primeraPaginaBloque = true;
    let saltoPaginaFragmentoActual = false;

    while (filasPendientes.length > 0) {
        const tituloHtml = primeraPaginaBloque ? datosOpcion.tituloHtml : "";
        const siguienteFila = filasPendientes[0];
        const filasPrueba = [...filasFragmento, siguienteFila.html];
        const alturaPrueba = medirHtmlFragmento(medidor, {
            tituloHtml,
            theadHtml: datosOpcion.theadHtml,
            rowsHtml: filasPrueba
        });
        const margenFila = siguienteFila.tipo === "resumen"
            ? MARGEN_SEGURIDAD_PX - TOLERANCIA_RESUMEN_PX
            : MARGEN_SEGURIDAD_PX;

        if (alturaPrueba > (espacioDisponible - margenFila) && filasFragmento.length > 0) {
            const alturaFragmento = medirHtmlFragmento(medidor, {
                tituloHtml,
                theadHtml: datosOpcion.theadHtml,
                rowsHtml: filasFragmento
            });

            fragmentos.push({
                html: construirHtmlFragmentoOpcion({
                    tituloHtml,
                    theadHtml: datosOpcion.theadHtml,
                    rowsHtml: filasFragmento,
                    saltoPagina: saltoPaginaFragmentoActual
                }),
                altura: alturaFragmento
            });

            filasFragmento = [];
            espacioDisponible = altoPaginaPx;
            primeraPaginaBloque = false;
            saltoPaginaFragmentoActual = true;
            continue;
        }

        if (
            alturaPrueba > (espacioDisponible - margenFila)
            && filasFragmento.length === 0
            && espacioDisponible < altoPaginaPx
        ) {
            espacioDisponible = altoPaginaPx;
            saltoPaginaFragmentoActual = true;
            continue;
        }

        filasFragmento.push(siguienteFila.html);
        filasPendientes.shift();

        if (filasPendientes.length === 0) {
            fragmentos.push({
                html: construirHtmlFragmentoOpcion({
                    tituloHtml,
                    theadHtml: datosOpcion.theadHtml,
                    rowsHtml: filasFragmento,
                    saltoPagina: saltoPaginaFragmentoActual
                }),
                altura: alturaPrueba
            });
            espacioDisponible = Math.max(0, espacioDisponible - alturaPrueba);
        }
    }

    return {
        fragmentos,
        espacioDisponibleFinal: espacioDisponible
    };
}

function optimizarSaltosPaginaOpciones() {
    const contenedor = document.getElementById("opcionesTablas");
    if (!contenedor) {
        return;
    }

    const bloques = Array.from(contenedor.querySelectorAll(".opcion-bloque"));
    if (!bloques.length) {
        return;
    }

    const altoPaginaPx = obtenerAlturaPaginaImpresionPx();
    let espacioDisponible = calcularEspacioDisponiblePrimeraPagina(contenedor, altoPaginaPx);
    const anchoMedicionPx = Math.min(
        contenedor.getBoundingClientRect().width,
        obtenerAnchoContenidoImpresionPx(contenedor)
    );
    const medidor = crearMedidorFragmentos(anchoMedicionPx);

    try {
        const nuevoHtml = [];

        bloques.forEach((bloque) => {
            const datos = obtenerFilasImprimiblesOpcion(bloque);
            if (!datos) {
                return;
            }

            const resultado = paginarFilasOpcion(datos, espacioDisponible, altoPaginaPx, medidor);
            resultado.fragmentos.forEach((fragmento) => {
                nuevoHtml.push(fragmento.html);
            });
            espacioDisponible = resultado.espacioDisponibleFinal;
        });

        contenedor.innerHTML = nuevoHtml.join("");
    } finally {
        medidor.remove();
    }
}

function limpiarSaltosPaginaOpciones() {
    refrescarCotizacion();
}

function renderizarTabla() {
    const contenedor = document.getElementById("opcionesTablas");
    if (!contenedor) {
        return;
    }

    const mostrarColumnaImagen = productos.some((producto) => Boolean(producto.imagen));
    sincronizarOpcionesDisponibles();

    contenedor.innerHTML = "";

    if (productos.length === 0) {
        contenedor.innerHTML = obtenerTablaVaciaHtml(mostrarColumnaImagen);
        return;
    }

    const opciones = agruparPorOpcion(productos);
    const llaves = Object.keys(opciones).sort((a, b) => Number(a) - Number(b));
    const numeroOpciones = llaves.length;
    contenedor.innerHTML = llaves.map((opcion) => {
        const productosOpcion = opciones[opcion];
        const resumenOpcion = calcularResumenOpcion(productosOpcion, opcion);
        const tituloOpcion = obtenerTituloOpcion(opcion);
        const filasProductosHtml = productosOpcion
            .map((producto) => obtenerFilaProductoHtml(producto, mostrarColumnaImagen))
            .join("");
        const encabezadoOpcionHtml = numeroOpciones > 1
            ? obtenerFilaEncabezadoOpcionHtml(opcion, resumenOpcion, mostrarColumnaImagen)
            : "";
        const resumenOpcionHtml = numeroOpciones > 1
            ? obtenerFilaResumenOpcionHtml(resumenOpcion, mostrarColumnaImagen)
            : "";
        const tituloVisibleHtml = tituloOpcion
            ? `
                <div class="opcion-header-title mb-2">
                    <span class="opcion-header-name">${escaparHtml(tituloOpcion)}</span>
                </div>
            `
            : "";

        return `
            <section class="opcion-bloque" data-opcion="${opcion}">
                ${tituloVisibleHtml}
                <table class="table table-bordered tabla-cotizacion">
                    ${obtenerEncabezadoTablaHtml(mostrarColumnaImagen)}
                    <tbody>
                        ${encabezadoOpcionHtml}
                        ${filasProductosHtml}
                        ${resumenOpcionHtml}
                    </tbody>
                </table>
            </section>
        `;
    }).join("");
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

function actualizarLayoutResumen({ mostrarNota, mostrarTotales }) {
    const layoutRow = document.querySelector(".nota-total-row");
    if (!layoutRow) {
        return;
    }

    layoutRow.classList.toggle("sin-nota", !mostrarNota);
    layoutRow.classList.toggle("sin-totales", !mostrarTotales);
}

function calcularTotales() {
    const opciones = agruparPorOpcion(productos);
    const numeroOpciones = Object.keys(opciones).length;
    const totalesGenerales = document.getElementById("totalesGenerales");
    const totalesCol = document.querySelector(".totales-col");
    const notaCard = document.getElementById("notaRapidaCard");
    const mostrarNota = Boolean(notaCard && !notaCard.classList.contains("d-none"));
    if (!totalesGenerales) {
        return;
    }

    if (numeroOpciones > 1) {
        if (totalesCol) {
            totalesCol.classList.add("d-none");
        }
        actualizarLayoutResumen({ mostrarNota, mostrarTotales: false });
        return;
    }

    if (totalesCol) {
        totalesCol.classList.remove("d-none");
    }
    totalesGenerales.style.display = "";
    const opcionUnica = Object.keys(opciones)[0] || "1";
    const resumen = calcularResumenOpcion(opciones[opcionUnica] || [], opcionUnica);
    const valorDescuento = resumen.valorDescuento;
    const valorIva = resumen.valorIva;
    const total = resumen.total;
    const mostrarSubtotal = resumen.subtotal !== total;

    document.getElementById("subtotal").innerText = formatoPeso(resumen.subtotal);
    document.getElementById("descuentoValor").innerText = formatoPeso(valorDescuento);
    const descuentoBadge = document.getElementById("descuentoBadge");
    if (descuentoBadge) {
        descuentoBadge.innerText = `${formatoNumero(resumen.descuentoPorcentaje)}% OFF`;
    }
    const descuentoSubtitulo = document.getElementById("descuentoSubtitulo");
    if (descuentoSubtitulo) {
        descuentoSubtitulo.innerText = valorDescuento > 0
            ? `Descuento de ${formatoNumero(resumen.descuentoPorcentaje)}% equivalente a ${formatoPeso(valorDescuento)}`
            : "Ahorro sobre el precio original";
    }
    const descuentoOpcionUnicaInput = document.getElementById("descuentoOpcionUnica");
    if (descuentoOpcionUnicaInput) {
        descuentoOpcionUnicaInput.value = resumen.descuentoPorcentaje;
    }
    const ivaValor = document.getElementById("ivaValor");
    if (ivaValor) {
        ivaValor.innerText = formatoPeso(valorIva);
    }
    const ivaOpcionUnicaCheckbox = document.getElementById("aplicarIvaOpcionUnica");
    if (ivaOpcionUnicaCheckbox) {
        ivaOpcionUnicaCheckbox.checked = resumen.ivaAplicado;
    }
    document.getElementById("totalGeneral").innerText = formatoPeso(total);
    const subtotalSection = document.getElementById("subtotalSection");
    if (subtotalSection) {
        subtotalSection.classList.toggle("d-flex", mostrarSubtotal);
        subtotalSection.classList.toggle("d-none", !mostrarSubtotal);
        subtotalSection.classList.toggle("tiene-descuento", valorDescuento > 0);
    }
    const subtotalHelper = document.getElementById("subtotalHelper");
    if (subtotalHelper) {
        const mostrarTextoDescuento = valorDescuento > 0;
        subtotalHelper.innerText = mostrarTextoDescuento ? "Valor antes del descuento" : "";
        subtotalHelper.style.display = mostrarTextoDescuento ? "" : "none";
    }

    const descuentoSection = document.getElementById("descuentoSection");
    if (descuentoSection) {
        if (valorDescuento > 0) {
            descuentoSection.classList.add("visible");
        } else {
            descuentoSection.classList.remove("visible");
        }
    }

    const ivaSection = document.getElementById("ivaSection");
    if (ivaSection) {
        if (resumen.ivaAplicado) {
            ivaSection.classList.add("visible");
        } else {
            ivaSection.classList.remove("visible");
        }
    }

    actualizarLayoutResumen({ mostrarNota, mostrarTotales: true });
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
    const notaMedia = document.getElementById("notaRapidaMedia");
    const notaImagenPreview = document.getElementById("notaRapidaImagenPreview");

    if (!notaTexto) {
        return;
    }

    const texto = notaInput ? notaInput.value.trim() : "";
    const mostrarImagen = notaConfirmada && Boolean(notaImagen);
    const mostrarNota = notaConfirmada && (texto.length > 0 || mostrarImagen);

    if (notaCard) {
        notaCard.classList.toggle("d-none", !mostrarNota);
        notaCard.classList.toggle("con-imagen", mostrarImagen);
    }

    notaTexto.innerText = mostrarNota ? texto : "";
    if (notaImagenPreview) {
        notaImagenPreview.classList.toggle("d-none", !mostrarImagen);
        notaImagenPreview.src = mostrarImagen ? notaImagen : "";
    }
    if (notaMedia) {
        notaMedia.classList.toggle("sin-imagen", !mostrarImagen);
    }
    const totalesVisibles = !document.querySelector(".totales-col")?.classList.contains("d-none");
    actualizarLayoutResumen({ mostrarNota, mostrarTotales: totalesVisibles });
}
