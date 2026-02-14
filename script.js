document.addEventListener("DOMContentLoaded", () => {

  const servicesBtn = document.getElementById("servicesBtn");
  const contactBtn = document.getElementById("contactBtn");
  const whatsappBtn = document.getElementById("whatsappBtn");
  const contratar99 = document.getElementById("contratar99");
  const contratar149 = document.getElementById("contratar149");

  servicesBtn.addEventListener("click", () => {
    document.getElementById("services").scrollIntoView({ behavior: "smooth" });
  });

  contactBtn.addEventListener("click", () => {
    document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  });

  whatsappBtn.addEventListener("click", () => {
    const numero = "529811064643";
    const mensaje = "Hola Abner, me interesa tu servicio de desarrollo web.";
    const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
  });

  if (contratar99) {
    contratar99.addEventListener("click", () => {
      const numero = "529811064643";
      const mensaje = "Hola Abner, quiero contratar el Menú Digital Profesional de $99/mes.";
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
    });
  }

  if (contratar149) {
    contratar149.addEventListener("click", () => {
      const numero = "529811064643";
      const mensaje = "Hola Abner, quiero contratar el Menú Digital Profesional de $149/mes.";
      const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, "_blank");
    });
  }

});

