document.addEventListener("DOMContentLoaded", () => {

  const contactBtn = document.getElementById("contactBtn");
  const whatsappBtn = document.getElementById("whatsappBtn");
  const heroWhatsapp = document.getElementById("heroWhatsapp");
  const contratarBtns = document.querySelectorAll(".contratar-btn");

  const numero = "529811064643";

  function abrirWhatsApp(mensaje){
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  }

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

  if (heroWhatsapp) {
    heroWhatsapp.addEventListener("click", () => {
      abrirWhatsApp("Hola Abner, quiero cotizar un menú digital.");
    });
  }

  contratarBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const mensaje = btn.getAttribute("data-msg");
      abrirWhatsApp(mensaje);
    });
  });

});