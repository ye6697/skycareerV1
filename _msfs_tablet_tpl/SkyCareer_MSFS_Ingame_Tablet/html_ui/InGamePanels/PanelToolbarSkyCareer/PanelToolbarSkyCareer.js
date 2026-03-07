class SkyCareerToolbarPanel extends TemplateElement {
  connectedCallback() {
    super.connectedCallback();
    this.frame = this.querySelector("#skycareerFrame");
  }

  disconnectedCallback() {
    super.disconnectedCallback();
  }
}

window.customElements.define("ingamepanel-skycareer", SkyCareerToolbarPanel);
checkAutoload();
