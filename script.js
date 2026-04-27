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

  // 🔑 CAMBIA ESTA CLAVE
  const CLAVE_CORRECTA = "abner123";

  // 🔗 PEGA TU LINK DE STRIPE AQUÍ
  const STRIPE_LINK = "https://buy.stripe.com/28EcN76HigRa39YbWH18c00";

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
    if (clientKey.value === CLAVE_CORRECTA) {
      loginView.classList.add("hidden");
      panelView.classList.remove("hidden");
    } else {
      alert("Clave incorrecta");
    }
  });

  // PAGO
  payBtn.addEventListener("click", () => {
    window.open(STRIPE_LINK, "_blank");
  });

  // LOGOUT
  logoutBtn.addEventListener("click", () => {
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
