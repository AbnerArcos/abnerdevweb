document.addEventListener("DOMContentLoaded", () => {

  const contactBtn = document.getElementById("contactBtn");
  const whatsappBtn = document.getElementById("whatsappBtn");
  const contratarBtns = document.querySelectorAll(".contratar-btn");

  const clientAreaBtn = document.getElementById("clientAreaBtn");
  const clientModal = document.getElementById("clientModal");
  const loginBtn = document.getElementById("loginBtn");
  const clientKey = document.getElementById("clientKey");

  const loginView = document.getElementById("loginView");
  const panelView = document.getElementById("panelView");

  const payBtn = document.getElementById("payBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  const numero = "529811064643";

  // 🔐 CLIENTES (CLAVE → DATOS)
  const CLIENTES = {
    "MenusDigitales": {
      nombre: "MenusDigitales",
      link: "https://buy.stripe.com/28EcN76HigRa39YbWH18c00"
    },
    "Menu20": {
      nombre: "MenuDigitalprueba",
      link: "https://buy.stripe.com/eVqaEZ8Pq0Sc7qebWH18c02"
    }
  };

  let clienteActual = null;

  function abrirWhatsApp(mensaje){
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  }

  // CONTACTO
  if (contactBtn) {
    contactBtn.addEventListener("click", () => {
      document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
    });
  }

  if (whatsappBtn) {
    whatsappBtn.addEventListener("click", () => {
      abrirWhatsApp("Hola Abner, quiero información sobre tus servicios.");
    });
  }

  contratarBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const mensaje = btn.getAttribute("data-msg");
      abrirWhatsApp(mensaje);
    });
  });

  // ABRIR MODAL
  clientAreaBtn.addEventListener("click", () => {
    clientModal.classList.remove("hidden");
  });

  // LOGIN
  loginBtn.addEventListener("click", () => {
    const clave = clientKey.value.trim();

    if (CLIENTES[clave]) {
      clienteActual = CLIENTES[clave];

      // guardar sesión
      localStorage.setItem("cliente", JSON.stringify(clienteActual));

      mostrarPanel();
    } else {
      alert("Clave incorrecta");
    }
  });

  // MOSTRAR PANEL
  function mostrarPanel(){
    loginView.classList.add("hidden");
    panelView.classList.remove("hidden");

    // mostrar nombre del negocio
    const titulo = panelView.querySelector("h2");
    titulo.textContent = clienteActual.nombre;
  }

  // AUTO LOGIN (si ya inició sesión antes)
  const clienteGuardado = localStorage.getItem("cliente");
  if (clienteGuardado) {
    clienteActual = JSON.parse(clienteGuardado);
    mostrarPanel();
  }

  // PAGO
  payBtn.addEventListener("click", () => {
    if (clienteActual && clienteActual.link) {
      window.open(clienteActual.link, "_blank");
    }
  });

  // LOGOUT
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("cliente");
    clienteActual = null;

    panelView.classList.add("hidden");
    loginView.classList.remove("hidden");
    clientModal.classList.add("hidden");
    clientKey.value = "";
  });

  // CERRAR AL HACER CLICK FUERA
  window.addEventListener("click", (e) => {
    if (e.target === clientModal) {
      clientModal.classList.add("hidden");
    }
  });

});
