document.addEventListener("DOMContentLoaded", () => {

/* =====================
   CARRITO
===================== */
let cart = JSON.parse(localStorage.getItem("cart")) || {};
let total = Number(localStorage.getItem("total")) || 0;

const cards = document.querySelectorAll(".card");
const summary = document.getElementById("cart-summary");
const cartModal = document.getElementById("cartModal");
const cartItems = document.getElementById("cartItems");
const toast = document.getElementById("toast");
const openCartBtn = document.getElementById("openCart");
const closeCartBtn = document.getElementById("closeCart");
const sendOrderBtn = document.getElementById("sendOrder");
const customerNameInput = document.getElementById("customerName");
const getLocationBtn = document.getElementById("getLocation");
let locationLink = "";

// Evitar que el input dispare el click del producto
document.querySelectorAll(".sugerencia-input").forEach(input => {
  input.addEventListener("click", e => e.stopPropagation());
});

// Crear botón eliminar en cada card
cards.forEach(card => {
  const imgContainer = card.querySelector(".img-container");

  const deleteBtn = document.createElement("div");
  deleteBtn.classList.add("delete-badge");
  deleteBtn.innerText = "✕";

  imgContainer.appendChild(deleteBtn);

  deleteBtn.onclick = (e) => {
    e.stopPropagation(); // evita que agregue producto

    const name = card.dataset.name;

    if (!cart[name]) return;

    const confirmar = confirm("¿Eliminar este producto completamente?");
    if (!confirmar) return;

    total -= cart[name].qty * cart[name].price;
    delete cart[name];

    saveData();
    restoreBadges();
    updateCart();
  };
});


/* ===== INICIO ===== */
restoreBadges();
updateCart();



/* ===== NOMBRE ===== */
if (customerNameInput) {
  customerNameInput.value = localStorage.getItem("customerName") || "";
  customerNameInput.oninput = () =>
    localStorage.setItem("customerName", customerNameInput.value);
}

/* ===== AGREGAR ===== */
/* ===== AGREGAR ===== */
cards.forEach(card => {
  card.addEventListener("click", () => {

    const name = card.dataset.name;
    const price = Number(card.dataset.price);
    const noteInput = card.querySelector(".sugerencia-input");
    const note = noteInput ? noteInput.value.trim() : "";

    if (!cart[name]) {
      cart[name] = { qty: 0, price, note: "" };
    }

    cart[name].qty++;
    total += price;

    // Siempre actualizar la nota si hay texto
    cart[name].note = note;

    saveData();
    restoreBadges();
    showToast();
    updateCart();

  });
});

/* ===== CARRITO ===== */
function updateCart() {
  if (!summary || !cartItems) return;

  cartItems.innerHTML = "";
  let count = 0;

  for (let item in cart) {
    count += cart[item].qty;
    const subtotal = (cart[item].qty * cart[item].price).toFixed(2);

cartItems.innerHTML += `
  <div class="cart-item">
    <span class="item-name">${item}</span>

    <div class="qty-controls">
      <button class="minus-btn" data-item="${item}">−</button>
      <span>${cart[item].qty}</span>
      <button class="plus-btn" data-item="${item}">+</button>
    </div>

    <span class="item-price">$${subtotal}</span>
  </div>
`;
  }

  summary.innerText = `${count} productos - $${total.toFixed(2)}`;

  // ➕ SUMAR
document.querySelectorAll(".plus-btn").forEach(btn => {
  btn.onclick = () => {
    const item = btn.dataset.item;
    cart[item].qty++;
    total += cart[item].price;

    saveData();
    restoreBadges();
    updateCart();
  };
});

// ➖ RESTAR
document.querySelectorAll(".minus-btn").forEach(btn => {
  btn.onclick = () => {
    const item = btn.dataset.item;
    cart[item].qty--;
    total -= cart[item].price;

    if (cart[item].qty <= 0) {
      delete cart[item];
    }

    saveData();
    restoreBadges();
    updateCart();
  };
});
}

/* ===== WHATSAPP ===== */
if (sendOrderBtn) {
  sendOrderBtn.onclick = async () => {

    if (!customerNameInput.value.trim()) {
      alert("Escribe tu nombre");
      return;
    }

    if (!Object.keys(cart).length) {
      alert("Carrito vacío");
      return;
    }

    const orderType = document.querySelector("input[name='orderType']:checked");
    const paymentType = document.querySelector("input[name='paymentType']:checked");
    const addressInput = document.getElementById("address");
	const requiereCambio = document.querySelector("input[name='requiereCambio']:checked");


    if (!orderType) {
      alert("Selecciona tipo de pedido");
      return;
    }

    if (!paymentType) {
      alert("Selecciona forma de pago");
      return;
    }
	

    // ✅ AHORA SÍ: crear el mensaje primero
    let msg = "🍔 CHEF\n";
    msg += "Cliente: " + customerNameInput.value + "\n\n";

    for (let item in cart) {
      const sub = (cart[item].qty * cart[item].price).toFixed(2);
      msg += `${cart[item].qty} x ${item} - $${sub}\n`;
	  
	   if (cart[item].note) {
    msg += `   📝 ${cart[item].note}\n`;
  }
    }

    msg += "\nTotal: $" + total.toFixed(2);
    msg += "\nTipo de pedido: " + orderType.value;

    if (orderType.value === "domicilio") {

  if (!addressInput.value.trim()) {
    alert("Escribe tu dirección o usa tu ubicación");
    return;
  }

  msg += "\nDirección: " + addressInput.value;

  if (locationLink) {
    msg += "\n📍 Ubicación Google Maps: " + locationLink;
  }
}

    // 💳 FORMA DE PAGO
if (paymentType.value === "transferencia") {
  msg += "\nForma de pago: Transferencia";
} else {
  msg += "\nForma de pago: Efectivo";

  if (requiereCambio && requiereCambio.value === "si") {
    msg += "\nCambio para: $" + montoCambio.value;
  } else {
    msg += "\nNo requiere cambio";
  }
}
// ENVIAR A GOOGLE SHEETS
const itemsArray = [];

for (let item in cart) {
  itemsArray.push({
    nombre: item,
    cantidad: cart[item].qty,
    precio: cart[item].price
  });
}

	// 🔒 BLOQUEAR BOTÓN
	sendOrderBtn.disabled = true;
	const textoOriginal = sendOrderBtn.innerText;
	sendOrderBtn.innerText = "Enviando pedido...";
	sendOrderBtn.style.opacity = "0.6";

fetch("https://script.google.com/macros/s/AKfycbyGJlnvmafbFcEKK5RIESrH01NqGS6OBnZNimcZrJYTAy3ex49JeW2akv0tSAQ9-mMc/exec", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  },
  body: new URLSearchParams({
    cliente: customerNameInput.value,
    items: JSON.stringify(itemsArray)
  })
})
.then(res => res.text())
.then(data => {

  console.log("Respuesta de Sheets:", data);

  if (data !== "OK") {
    throw new Error("No respondió OK");
  }

  // 🧹 Limpiar carrito
  cart = {};
  total = 0;
  saveData();
  restoreBadges();
  updateCart();

  // 📲 Ir a WhatsApp
  window.location.href = "../menu-digital.html";
})
.catch(error => {

  console.error("Error al guardar en Sheets:", error);
  alert("Hubo un problema guardando el pedido");

  // 🔓 REACTIVAR BOTÓN
  sendOrderBtn.disabled = false;
  sendOrderBtn.innerText = textoOriginal;
  sendOrderBtn.style.opacity = "1";
});
  };
}

/* ===== STORAGE ===== */
function saveData(){
  localStorage.setItem("cart", JSON.stringify(cart));
  localStorage.setItem("total", total);
}

/* ===== BADGES ===== */
function restoreBadges(){

  document.querySelectorAll(".badge").forEach(b => b.style.display = "none");
  document.querySelectorAll(".delete-badge").forEach(b => b.style.display = "none");

  for (let item in cart){
    document.querySelectorAll(".card").forEach(card => {
      if (card.dataset.name === item){

        const badge = card.querySelector(".badge");
        const deleteBtn = card.querySelector(".delete-badge");

        badge.style.display = "flex";
        badge.innerText = cart[item].qty;

        deleteBtn.style.display = "flex";
      }
    });
  }
}

/* =====================
   DETECTAR TAB ACTIVO
===================== */

const tabs = document.querySelectorAll(".tabs a");
const sections = document.querySelectorAll(".section");

function detectarSeccionActiva() {
  let seccionActual = "";

  sections.forEach(section => {
    const sectionTop = section.offsetTop - 120;
    const sectionHeight = section.offsetHeight;

    if (
      window.scrollY >= sectionTop &&
      window.scrollY < sectionTop + sectionHeight
    ) {
      seccionActual = section.getAttribute("id");
    }
  });

  tabs.forEach(tab => {
    tab.classList.remove("active");
    if (tab.getAttribute("href") === "#" + seccionActual) {
      tab.classList.add("active");
    }
  });
}

window.addEventListener("scroll", detectarSeccionActiva);
detectarSeccionActiva();

/* ===== TOAST ===== */
function showToast(){
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1200);
}



/* ===== MODAL ===== */
if (openCartBtn) openCartBtn.onclick = () => cartModal.classList.toggle("active");
if (closeCartBtn) closeCartBtn.onclick = () => cartModal.classList.remove("active");

const orderTypeRadios = document.querySelectorAll("input[name='orderType']");
const addressSection = document.getElementById("addressSection");

/* =====================
   CAMBIO EN EFECTIVO
===================== */

const efectivoRadio = document.querySelector(
  "input[name='paymentType'][value='efectivo']"
);
const transferenciaRadio = document.querySelector(
  "input[name='paymentType'][value='transferencia']"
);
const campoCambio = document.getElementById("campo-cambio");
const montoCambio = document.getElementById("monto-cambio");
const datosTransferencia = document.getElementById("datos-transferencia");


const paymentRadios = document.querySelectorAll("input[name='paymentType']");
const requiereCambioRadios = document.querySelectorAll("input[name='requiereCambio']");

paymentRadios.forEach(radio => {
  radio.addEventListener("change", function () {

    if (this.value === "efectivo") {
      campoCambio.style.display = "block";
      datosTransferencia.style.display = "none";
    } else {
      campoCambio.style.display = "none";
      montoCambio.style.display = "none";
      datosTransferencia.style.display = "block";
    }

  });
});

requiereCambioRadios.forEach(radio => {
  radio.addEventListener("change", function () {
    if (this.value === "si") {
      montoCambio.style.display = "block";
    } else {
      montoCambio.style.display = "none";
    }
  });
});


orderTypeRadios.forEach(radio => {
  radio.addEventListener("change", function () {

    if (this.value === "domicilio") {
      addressSection.style.display = "block";
    } else {
      addressSection.style.display = "none";
    }

  });
});

if (getLocationBtn) {
  getLocationBtn.onclick = () => {

    if (!navigator.geolocation) {
      alert("Tu celular no soporta ubicación");
      return;
    }

    getLocationBtn.innerText = "Obteniendo ubicación...";
	
	

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        locationLink = `https://maps.google.com/?q=${lat},${lng}`;

        document.getElementById("address").value =
          "Ubicación enviada por GPS 📍";

        getLocationBtn.innerText = "📍 Ubicación lista";
      },
      () => {
        alert("No se pudo obtener la ubicación");
        getLocationBtn.innerText = "📍 Usar ubicación actual";
      }
    );
  };
}

});






