document.getElementById("year")?.append(new Date().getFullYear());

const filterButtons = document.querySelectorAll("[data-filter]");
const galleryItems = document.querySelectorAll("[data-category]");
filterButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    filterButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const filter = btn.dataset.filter;
    galleryItems.forEach(item => {
      item.style.display = (filter === "all" || item.dataset.category === filter) ? "flex" : "none";
    });
  });
});

const choices = document.querySelectorAll(".service-choice");
const sections = {
  dtf: document.getElementById("dtfFields"),
  laser: document.getElementById("laserFields"),
  print3d: document.getElementById("print3dFields")
};
choices.forEach(choice => {
  choice.addEventListener("click", () => {
    choices.forEach(c => c.classList.remove("active"));
    choice.classList.add("active");
    const service = choice.dataset.service;
    Object.values(sections).forEach(s => s && s.classList.remove("active"));
    if (sections[service]) sections[service].classList.add("active");
  });
});

const quoteForm = document.getElementById("quoteForm");
const quoteStatus = document.getElementById("quoteStatus");
if (quoteForm) {
  quoteForm.addEventListener("submit", async e => {
    e.preventDefault();
    quoteStatus.className = "quote-status show";
    quoteStatus.textContent = "Sending your request...";
    try {
      const formData = new FormData(quoteForm);
      const res = await fetch("/", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Submission failed");
      quoteStatus.textContent = "Thanks — your quote request was submitted. We’ll review it and follow up.";
      quoteForm.reset();
      choices.forEach(c => c.classList.remove("active"));
      Object.values(sections).forEach(s => s && s.classList.remove("active"));
    } catch {
      quoteStatus.textContent = "The form could not be submitted. Please email sales@4zero2creations.com instead.";
      quoteStatus.className = "quote-status error";
    }
  });
}
