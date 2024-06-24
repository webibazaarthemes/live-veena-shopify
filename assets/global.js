function getFocusableElements(container) {
  return Array.from(
      container.querySelectorAll(
          "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
      )
  );
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute('role', 'button');
  summary.setAttribute('aria-expanded', summary.parentNode.hasAttribute('open'));

  if(summary.nextElementSibling.getAttribute('id')) {
    summary.setAttribute('aria-controls', summary.nextElementSibling.id);
  }

  summary.addEventListener('click', (event) => {
    event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
  });

  if (summary.closest('header-drawer')) return;
  summary.parentElement.addEventListener('keyup', onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
        event.target !== container &&
        event.target !== last &&
        event.target !== first
    )
      return;

    document.addEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function() {
    document.removeEventListener('keydown', trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function(event) {
    if (event.code.toUpperCase() !== 'TAB') return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
        (event.target === container || event.target === first) &&
        event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener('focusout', trapFocusHandlers.focusout);
  document.addEventListener('focusin', trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (elementToFocus.tagName === 'INPUT' &&
      ['search', 'text', 'email', 'url'].includes(elementToFocus.type) &&
      elementToFocus.value) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch(e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = ['ARROWUP', 'ARROWDOWN', 'ARROWLEFT', 'ARROWRIGHT', 'TAB', 'ENTER', 'SPACE', 'ESCAPE', 'HOME', 'END', 'PAGEUP', 'PAGEDOWN']
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener('keydown', (event) => {
    if(navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener('mousedown', (event) => {
    mouseClick = true;
  });

  window.addEventListener('focus', () => {
    if (currentFocusedElement) currentFocusedElement.classList.remove('focused');

    if (mouseClick) return;

    currentFocusedElement = document.activeElement;
    currentFocusedElement.classList.add('focused');

  }, true);
}

function pauseAllMedia() {
  document.querySelectorAll('.js-youtube').forEach((video) => {
    video.contentWindow.postMessage('{"event":"command","func":"' + 'pauseVideo' + '","args":""}', '*');
  });
  document.querySelectorAll('.js-vimeo').forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', '*');
  });
  document.querySelectorAll('video').forEach((video) => video.pause());
  document.querySelectorAll('product-model').forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener('focusin', trapFocusHandlers.focusin);
  document.removeEventListener('focusout', trapFocusHandlers.focusout);
  document.removeEventListener('keydown', trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input');
    this.changeEvent = new Event('change', { bubbles: true });

    this.input.addEventListener('change', this.onInputChange.bind(this));
    this.querySelectorAll('button').forEach(
        (button) => button.addEventListener('click', this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const min = parseInt(this.input.min);
      const buttonMinus = this.querySelector(".quantity__button[name='minus']");
      buttonMinus.classList.toggle('disabled', value <= min);
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity__button[name='plus']");
      buttonPlus.classList.toggle('disabled', value >= max);
    }
  }
}

customElements.define('quantity-input', QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function throttle(fn, delay) {
  let lastCall = 0;
  return function (...args) {
    const now = new Date().getTime();
    if (now - lastCall < delay) {
      return;
    }
    lastCall = now;
    return fn(...args);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': `application/${type}` }
  };
}

/*
 * Shopify Common JS
 *
 */
if ((typeof window.Shopify) == 'undefined') {
  window.Shopify = {};
}

Shopify.bind = function(fn, scope) {
  return function() {
    return fn.apply(scope, arguments);
  }
};

Shopify.setSelectorByValue = function(selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function(target, eventName, callback) {
  target.addEventListener ? target.addEventListener(eventName, callback, false) : target.attachEvent('on'+eventName, callback);
};

Shopify.postLink = function(path, options) {
  options = options || {};
  var method = options['method'] || 'post';
  var params = options['parameters'] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for(var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function(country_domid, province_domid, options) {
  this.countryEl         = document.getElementById(country_domid);
  this.provinceEl        = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(options['hideElement'] || province_domid);

  Shopify.addListener(this.countryEl, 'change', Shopify.bind(this.countryHandler,this));

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function() {
    var value = this.countryEl.getAttribute('data-default');
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function() {
    var value = this.provinceEl.getAttribute('data-default');
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function(e) {
    var opt       = this.countryEl.options[this.countryEl.selectedIndex];
    var raw       = opt.getAttribute('data-provinces');
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = 'none';
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement('option');
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function(selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function(selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement('option');
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  }
};

class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector('details');

    this.addEventListener('keyup', this.onKeyUp.bind(this));
    this.addEventListener('focusout', this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll('summary').forEach(summary => summary.addEventListener('click', this.onSummaryClick.bind(this)));
    this.querySelectorAll('button:not(.localization-selector)').forEach(button => button.addEventListener('click', this.onCloseButtonClick.bind(this)));
  }

  onKeyUp(event) {
    if(event.code.toUpperCase() !== 'ESCAPE') return;

    const openDetailsElement = event.target.closest('details[open]');
    if(!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle ? this.closeMenuDrawer(event, this.mainDetailsToggle.querySelector('summary')) : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest('.has-submenu');
    const isOpen = detailsElement.hasAttribute('open');
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function addTrapFocus() {
      trapFocus(summaryElement.nextElementSibling, detailsElement.querySelector('button'));
      summaryElement.nextElementSibling.removeEventListener('transitionend', addTrapFocus);
    }

    if (detailsElement === this.mainDetailsToggle) {
      if(isOpen) event.preventDefault();
      isOpen ? this.closeMenuDrawer(event, summaryElement) : this.openMenuDrawer(summaryElement);

      if (window.matchMedia('(max-width: 992px)')) {
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add('menu-opening');
        summaryElement.setAttribute('aria-expanded', true);
        parentMenuElement && parentMenuElement.classList.add('submenu-open');
        !reducedMotion || reducedMotion.matches ? addTrapFocus() : summaryElement.nextElementSibling.addEventListener('transitionend', addTrapFocus);
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });
    summaryElement.setAttribute('aria-expanded', true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove('menu-opening');
    this.mainDetailsToggle.querySelectorAll('details').forEach(details => {
      details.removeAttribute('open');
      details.classList.remove('menu-opening');
    });
    this.mainDetailsToggle.querySelectorAll('.submenu-open').forEach(submenu => {
      submenu.classList.remove('submenu-open');
    });
    document.body.classList.remove(`overflow-hidden-${this.dataset.breakpoint}`);
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);
    
  }

  onFocusOut() {
    setTimeout(() => {
      if (this.mainDetailsToggle && this.mainDetailsToggle.hasAttribute('open') && !this.mainDetailsToggle.contains(document.activeElement)) this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest('details');
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest('.submenu-open');
    parentMenuElement && parentMenuElement.classList.remove('submenu-open');
    detailsElement.classList.remove('menu-opening');
    detailsElement.querySelector('summary').setAttribute('aria-expanded', false);
    removeTrapFocus(detailsElement.querySelector('summary'));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute('open');
        if (detailsElement.closest('details[open]')) {
          trapFocus(detailsElement.closest('details[open]'), detailsElement.querySelector('summary'));
        }
      }
    }

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define('menu-drawer', MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector('.section-header');
    this.borderOffset = this.borderOffset || this.closest('.header-wrapper').classList.contains('header-wrapper--border-bottom') ? 1 : 0;
    document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);
    this.header.classList.add('menu-open');

    setTimeout(() => {
      this.mainDetailsToggle.classList.add('menu-opening');
    });

    summaryElement.setAttribute('aria-expanded', true);
    window.addEventListener('resize', this.onResize);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
    document.body.classList.add(`menu-overflow-remove`);
  }

  closeMenuDrawer(event, elementToFocus) {
    if (!elementToFocus) return;
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove('menu-open');
    window.removeEventListener('resize', this.onResize);
  }

  onResize = () => {
    this.header && document.documentElement.style.setProperty('--header-bottom-position', `${parseInt(this.header.getBoundingClientRect().bottom - this.borderOffset)}px`);
    document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
  };
}

customElements.define('header-drawer', HeaderDrawer);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener(
        'click',
        this.hide.bind(this, false)
    );
    this.addEventListener('keyup', (event) => {
      if (event.code.toUpperCase() === 'ESCAPE') this.hide();
    });
    if (this.classList.contains('media-modal')) {
      this.addEventListener('pointerup', (event) => {
        if (event.pointerType === 'mouse' && !event.target.closest('deferred-media, product-model')) this.hide();
      });
    } else {
      this.addEventListener('click', (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector('.template-popup');
    document.body.classList.add('overflow-hidden');
    this.setAttribute('open', '');
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove('overflow-hidden');
    document.body.dispatchEvent(new CustomEvent('modalClosed'));
    this.removeAttribute('open');
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define('modal-dialog', ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector('button');

    if (!button) return;
    button.addEventListener('click', () => {
      const modal = document.querySelector(this.getAttribute('data-modal'));
      if (modal) modal.show(button);
    });
  }
}
customElements.define('modal-opener', ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener('click', this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute('loaded')) {
      const content = document.createElement('div');
      content.appendChild(this.querySelector('template').content.firstElementChild.cloneNode(true));

      this.setAttribute('loaded', true);
      const deferredElement = this.appendChild(content.querySelector('video, model-viewer, iframe'));
      if (focus) deferredElement.focus();
      if (deferredElement.nodeName == 'VIDEO' && deferredElement.getAttribute('autoplay')) {
        // force autoplay for safari
        deferredElement.play();
      }
    }
  }
}

customElements.define('deferred-media', DeferredMedia);


class SliderComponent extends HTMLElement {
  constructor() {
    super();
    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector('.slider-counter--current');
    this.pageTotalElement = this.querySelector('.slider-counter--total');
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    this.initPages();
    const resizeObserver = new ResizeObserver((entries) => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener('scroll', this.update.bind(this));
    this.prevButton.addEventListener('click', this.onButtonClick.bind(this));
    this.nextButton.addEventListener('click', this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter((element) => element.clientWidth > 0);
    if (this.sliderItemsToShow.length < 2) return;
    this.sliderItemOffset = this.sliderItemsToShow[1].offsetLeft - this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(
      (this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) / this.sliderItemOffset
    );
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;
    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    // Temporarily prevents unneeded updates resulting from variant changes
    // This should be refactored as part of https://github.com/Shopify/dawn/issues/2057
    if (!this.slider || !this.nextButton) return;

    const previousPage = this.currentPage;
    this.currentPage = Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(
        new CustomEvent('slideChanged', {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1],
          },
        })
      );
    }

    if (this.enableSliderLooping) return;

    if (this.isSlideVisible(this.sliderItemsToShow[0]) && this.slider.scrollLeft === 0) {
      this.prevButton.setAttribute('disabled', 'disabled');
    } else {
      this.prevButton.removeAttribute('disabled');
    }

    if (this.isSlideVisible(this.sliderItemsToShow[this.sliderItemsToShow.length - 1], -1)) {
      this.nextButton.setAttribute('disabled', 'disabled');
    } else {
      this.nextButton.removeAttribute('disabled');
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.clientWidth + this.slider.scrollLeft - offset;
    return element.offsetLeft + element.clientWidth <= lastVisibleSlide && element.offsetLeft >= this.slider.scrollLeft;
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition =
      event.currentTarget.name === 'next'
        ? this.slider.scrollLeft + step * this.sliderItemOffset
        : this.slider.scrollLeft - step * this.sliderItemOffset;
    this.setSlidePosition(this.slideScrollPosition);
  }

  setSlidePosition(position) {
    this.slider.scrollTo({
      left: position,
    });
  }
}

customElements.define('slider-component', SliderComponent);

class SlideshowComponent extends SliderComponent {
  constructor() {
    super();
    this.sliderControlWrapper = this.querySelector('.slider-buttons');
    this.enableSliderLooping = true;

    if (!this.sliderControlWrapper) return;

    // Define sliderItemsToShow here or ensure it's properly initialized
    this.sliderItemsToShow = this.slider.querySelectorAll('.slideshow__slide');

    this.sliderFirstItemNode = this.slider.querySelector('.slideshow__slide');
    if (this.sliderItemsToShow.length > 0) this.currentPage = 1;

    this.sliderControlLinksArray = Array.from(this.sliderControlWrapper.querySelectorAll('.slider-counter__link'));
    this.sliderControlLinksArray.forEach(link => link.addEventListener('click', this.linkToSlide.bind(this)));
    this.slider.addEventListener('scroll', this.setSlideVisibility.bind(this));
    this.setSlideVisibility();
    if (this.slider.getAttribute('data-autoplay') === 'true') this.setAutoPlay();

    // custom code
    this.extraVisibleElement = 0;
    this.sliderItemsToShow.forEach(ele => {
      if(this.isElementVisible(ele)) this.extraVisibleElement++;
    });
    if(this.extraVisibleElement!=0) this.extraVisibleElement--;
  }

  setAutoPlay() {
    this.sliderAutoplayButton = this.querySelector('.slideshow__autoplay');
    this.autoplaySpeed = this.slider.dataset.speed * 1000;

    this.sliderAutoplayButton.addEventListener('click', this.autoPlayToggle.bind(this));
    this.addEventListener('mouseover', this.focusInHandling.bind(this));
    this.addEventListener('mouseleave', this.focusOutHandling.bind(this));
    this.addEventListener('focusin', this.focusInHandling.bind(this));
    this.addEventListener('focusout', this.focusOutHandling.bind(this));

    this.play();
    this.autoplayButtonIsSetToPlay = true;
  }

  // custom code
  isElementVisible(element){
      const rect = element.getBoundingClientRect();
      const rect1 = this.getBoundingClientRect();

      return (
        rect.left >=  rect1.left &&
        rect.right <= rect1.right
      );
    };

  onButtonClick(event) {
    super.onButtonClick(event);
    const isFirstSlide = this.currentPage === 1;
    const isLastSlide = (this.currentPage + this.extraVisibleElement) === this.sliderItemsToShow.length; // custom code

    if (!isFirstSlide && !isLastSlide) return;
    if (isFirstSlide && event.currentTarget.name === 'previous') {
      this.slideScrollPosition = this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length;
    } else if (isLastSlide && event.currentTarget.name === 'next') {
      this.slideScrollPosition = 0;
    }
    this.slider.scrollTo({
      left: this.slideScrollPosition
    });
  }

  update() {
    super.update();
    this.sliderControlButtons = this.querySelectorAll('.slider-counter__link');
    this.prevButton.removeAttribute('disabled');

    if (!this.sliderControlButtons.length) return;

    this.sliderControlButtons.forEach(link => {
      link.classList.remove('slider-counter__link--active');
      link.removeAttribute('aria-current');
    });
    this.sliderControlButtons[this.currentPage - 1].classList.add('slider-counter__link--active');
    this.sliderControlButtons[this.currentPage - 1].setAttribute('aria-current', true);
  }

  autoPlayToggle() {
    this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
    this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
    this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
  }

  focusOutHandling(event) {
    const focusedOnAutoplayButton = event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
    if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
    this.play();
  }

  focusInHandling(event) {
    const focusedOnAutoplayButton = event.target === this.sliderAutoplayButton || this.sliderAutoplayButton.contains(event.target);
    if (focusedOnAutoplayButton && this.autoplayButtonIsSetToPlay) {
      this.play();
    } else if (this.autoplayButtonIsSetToPlay) {
      this.pause();
    }
  }

  play() {
    this.slider.setAttribute('aria-live', 'off');
    clearInterval(this.autoplay);
    this.autoplay = setInterval(this.autoRotateSlides.bind(this), this.autoplaySpeed);
  }

  pause() {
    this.slider.setAttribute('aria-live', 'polite');
    clearInterval(this.autoplay);
  }

  togglePlayButtonState(pauseAutoplay) {
    if (pauseAutoplay) {
      this.sliderAutoplayButton.classList.add('slideshow__autoplay--paused');
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.playSlideshow);
    } else {
      this.sliderAutoplayButton.classList.remove('slideshow__autoplay--paused');
      this.sliderAutoplayButton.setAttribute('aria-label', window.accessibilityStrings.pauseSlideshow);
    }
  }

  autoRotateSlides() {
    // custom code
    const slideScrollPosition = (this.currentPage + this.extraVisibleElement) === this.sliderItems.length ? 0 : this.slider.scrollLeft + this.slider.querySelector('.slideshow__slide').clientWidth;
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }

  setSlideVisibility() {
    this.sliderItemsToShow.forEach((item, index) => {
      const linkElements = item.querySelectorAll('a');

      if (index === this.currentPage - 1) {
        if (linkElements.length) linkElements.forEach(button => {
          button.removeAttribute('tabindex');
        });
        item.setAttribute('aria-hidden', 'false');
        item.removeAttribute('tabindex');
      } else {
        if (linkElements.length) linkElements.forEach(button => {
          button.setAttribute('tabindex', '-1');
        });
        item.setAttribute('aria-hidden', 'true');
        item.setAttribute('tabindex', '-1');
      }
    });
  }

  linkToSlide(event) {
    event.preventDefault();
    const slideScrollPosition = this.slider.scrollLeft + this.sliderFirstItemNode.clientWidth * (this.sliderControlLinksArray.indexOf(event.currentTarget) + 1 - this.currentPage);
    this.slider.scrollTo({
      left: slideScrollPosition
    });
  }
}

customElements.define('slideshow-component', SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', this.onVariantChange);
  }

  onVariantChange() {
    this.updateOptions();
    this.updateMasterId();
    this.toggleAddButton(true, '', false);
    this.updateSoldOutBadge();
    this.updatePickupAvailability();
    this.removeErrorMessage();
    this.updateVariantValue();
    this.updateVariantStatuses();

    if (!this.currentVariant) {
      this.toggleAddButton(true, '', true);
      this.setUnavailable();
    } else {
      this.updateMedia();
      this.updateURL();
      this.updateVariantInput();
      this.renderProductInfo();
      this.updateShareUrl();
      this.updateCardURL();
      this.updateStockCountdown();
    }
  }
  updateSoldOutBadge() {
    const card = this.closest('.card-wrapper');
    const soldOutBadge = card?.querySelector('.sold-out-badge');
  
    if (soldOutBadge) {
      const isAvailable = this.currentVariant && this.currentVariant.available;
      soldOutBadge.classList.toggle('hidden', isAvailable);
    }
  }
  updateVariantValue() {
    if (this.dataset.layout == 'button') {
      event.target.closest('fieldset').querySelector('legend span').innerHTML = event.target.value
    }
  }
  updateOptions() {
    this.options = Array.from(this.querySelectorAll('select'), (select) => select.value);
  }

  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options.map((option, index) => {
        return this.options[index] === option;
      }).includes(false);
    });
  }
  updateStockCountdown() {
    if (!this.currentVariant) return;

    if (this.dataset.layout == 'card') {
      let card = this.closest('.card');
      if (card && card.querySelector('.wbstockcount') != null) {
        let variantsData = JSON.parse(card.querySelector('#card_product-variants').innerHTML);
        let stockCountdownConfig = JSON.parse(card.querySelector('#card_product-stock-countdown-config').innerHTML);
        let variant = this.currentVariant;
        let countdownWrapper = card.querySelector('.wbstockcount');
        if (variantsData[variant.id]['q'] > 0 && variant.inventory_management == 'shopify') {
          card.querySelector('.wbstockcount').classList.remove('hidden');
          card.querySelector('.wbstockinfo-bar')?.classList.remove('hidden');
          if (variantsData[variant.id]['q'] > stockCountdownConfig.limited_stock_cut_off) { // High Stock
            countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_soon');
            countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_high');
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.instock_message.replace('{stock_number}', variantsData[variant.id]['q']);
            if (countdownWrapper.querySelector('.wbstockinfo-probar'))
              countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
          } else { // Low Stock
            countdownWrapper.querySelector('.wbstockinfo').classList.replace('wbstockinfo_soon', 'wbstockinfo_low');
            countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_low');
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.limited_stock_message.replace('{stock_number}', variantsData[variant.id]['q']);
            if (countdownWrapper.querySelector('.wbstockinfo-probar'))
              countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
          }
        } 
        else if (variantsData[variant.id]['p'] == "continue") {
          card.querySelector('.wbstockcount').classList.remove('hidden');
          card.querySelector('.wbstockinfo-bar')?.classList.add('hidden');
          countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_high');
          countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_soon');
          if (countdownWrapper.querySelector('.wbstockinfo'))
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.continue_selling_message.replace();
        }
        else {
          card.querySelector('.wbstockcount').classList.add('hidden');
        }
      }
    } else {  
      let productMain = this.closest('.product');
      if (productMain && productMain.querySelector('.wbstockcount') != null) {
        let variantsData = JSON.parse(productMain.querySelector('#product-variants').innerHTML);
        let stockCountdownConfig = JSON.parse(productMain.querySelector('#product-stock-countdown-config').innerHTML);
        let variant = this.currentVariant;
        let countdownWrapper = productMain.querySelector('.wbstockcount');
        if (variantsData[variant.id]['q'] > 0 && variant.inventory_management == 'shopify') {
          productMain.querySelector('.wbstockcount').classList.remove('hidden');
          productMain.querySelector('.wbstockinfo-bar').classList.remove('hidden');
          if (variantsData[variant.id]['q'] > stockCountdownConfig.limited_stock_cut_off) { // High Stock
            countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_soon');
            countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_high');
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.instock_message.replace('{stock_number}', variantsData[variant.id]['q']);
            countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
          } else { // Low Stock
            countdownWrapper.querySelector('.wbstockinfo').classList.replace('wbstockinfo_soon', 'wbstockinfo_low');
            countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_low');
            countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.limited_stock_message.replace('{stock_number}', variantsData[variant.id]['q']);
            countdownWrapper.querySelector('.wbstockinfo-probar').style.width = ((variantsData[variant.id]['q'] * 100) / stockCountdownConfig.max_stock) + '%';
          }
        } 
        else if (variantsData[variant.id]['p'] == "continue") {
          productMain.querySelector('.wbstockcount').classList.remove('hidden');
          productMain.querySelector('.wbstockinfo-bar').classList.add('hidden');
          countdownWrapper.querySelector('.wbstockinfo').classList.remove('wbstockinfo_low', 'wbstockinfo_high');
          countdownWrapper.querySelector('.wbstockinfo').classList.add('wbstockinfo_soon');
          countdownWrapper.querySelector('.wbstockinfo').innerHTML = stockCountdownConfig.continue_selling_message.replace();
        }
        else {
          productMain.querySelector('.wbstockcount').classList.add('hidden');
        }
      }
    }
  }
  updateMedia() {
    if (!this.currentVariant) return;
    if (!this.currentVariant.featured_media) return;

    // Variant in Product Card
    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const newMedia = card.querySelector(
          `[data-media-id="${this.dataset.section}-${this.dataset.product}-${this.currentVariant.featured_media.id}"]`
      );
      if (!newMedia) return;
      const modalContent = card.querySelector('.card__media');
      const newMediaModal = modalContent.querySelector( `[data-media-id="${this.currentVariant.featured_media.id}"]`);
      const parent = newMedia.parentElement;
      if (parent.firstChild == newMedia) return;
      parent.prepend(newMedia);
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (this.stickyHeader) {
        this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
      }
    } else {
      const mediaGalleries = document.querySelectorAll(`[id^="MediaGallery-${this.dataset.section}"]`);
      mediaGalleries.forEach((mediaGallery) =>
        mediaGallery.setActiveMedia(`${this.dataset.section}-${this.currentVariant.featured_media.id}`, true)
      );
      const modalContent = document.querySelector(`#ProductModal-${this.dataset.section} .product-media-modal__content`);
      if (!modalContent) return;
      const newMediaModal = modalContent.querySelector(`[data-media-id="${this.currentVariant.featured_media.id}"]`);
      modalContent.prepend(newMediaModal);

    }
  }
  updateCardURL() {
    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const modalContent = card.querySelector('.card__media');
      const productAnchor = modalContent.querySelector('a');
      const productTitle = card.querySelector('.card__heading');
      const productTitleAnchor = productTitle.querySelector('a');
      const productQuickview = card.querySelector('.js-wbquickview-link');
      let productURL = this.updateURLParameter(this.dataset.url, 'variant', this.currentVariant.id);
      productAnchor.setAttribute('href', productURL);
      productTitleAnchor.setAttribute('href', productURL);
      if (productQuickview) {
        productQuickview.setAttribute('variant-id', this.currentVariant.id);
      }
    }
  }
  updateURLParameter(url, param, paramVal){
    var newAdditionalURL = "";
    var tempArray = url.split("?");
    var baseURL = tempArray[0];
    var additionalURL = tempArray[1];
    var temp = "";
    if (additionalURL) {
      tempArray = additionalURL.split("&");
      for (var i=0; i<tempArray.length; i++){
        if(tempArray[i].split('=')[0] != param){
          newAdditionalURL += temp + tempArray[i];
          temp = "&";
        }
      }
    }
    var rows_txt = temp + "" + param + "=" + paramVal;
    return baseURL + "?" + newAdditionalURL + rows_txt;
  }
  updateURL() {
    if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
    window.history.replaceState({ }, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateShareUrl() {
    const shareButton = document.getElementById(`Share-${this.dataset.section}`);
    if (!shareButton || !shareButton.updateUrl) return;
    shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
  }

  updateVariantInput() {
    // Variant in Product Card
    if (this.dataset.layout == 'card') {
      const card = this.closest('.card');
      const productForms = card.querySelectorAll(`#ProductInfo-${this.dataset.section}-${this.dataset.product}`);
      productForms.forEach((productForm) => {
        const input = productForm.querySelectorAll('input[name="id"]');
        Array.from(input).forEach((element,index) =>
        {
          element.value = this.currentVariant.id;
        });
        const select = productForm.querySelectorAll('select[name="id"]');
        Array.from(select).forEach((element,index) =>
        {
          element.value = this.currentVariant.id;
        });

        const fieldsets = Array.from(this.querySelectorAll('fieldset'));
        fieldsets.forEach(function(option) {
          Array.from(option.querySelectorAll('label')).find((element) => element.classList.remove('active'));
        });
        const optionData = this.closest('.grid__item').querySelectorAll('select option');
        const regularPrice = this.closest('.grid__item').querySelector('.price.price__container .price__regular .price-item--regular');
        const saleRegularPrice = this.closest('.grid__item').querySelector('.price.price__container .price__sale .price-item--sale');
        const salePrice = this.closest('.grid__item').querySelector('.price.price__container .price__sale .price-item--regular');
        const wbunitPrice = this.closest('.grid__item').querySelector('.price.price__container .unit-price .cardunitp');
        const wbunitValue = this.closest('.grid__item').querySelector('.price.price__container .unit-price .cardunitv');
          
        const wbPercentBadge = this.closest('.grid__item').querySelector('.card__badge .percent__badge-sale');
        const wbAmountBadge = this.closest('.grid__item').querySelector('.card__badge .amount__badge-sale');
        
        optionData.forEach((data) => {
          if(data.value == this.currentVariant.id) {
            if(data.dataset.cprice != '' &&  data.dataset.price != data.dataset.cprice) {
              saleRegularPrice.innerHTML = data.dataset.price;
              salePrice.innerHTML = data.dataset.cprice;
              if(data.dataset.damount != '') {
                wbAmountBadge.innerHTML = data.dataset.damount;
                wbAmountBadge.classList.remove('hidden');
              }
              if(data.dataset.percent != '') {
                wbPercentBadge.innerHTML = data.dataset.percent;
                wbPercentBadge.classList.remove('hidden');
              }
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
            else {
              regularPrice.innerHTML = data.dataset.price;
              if(wbPercentBadge){
                wbPercentBadge.classList.add('hidden');
              }
              if(wbAmountBadge){
                wbAmountBadge.classList.add('hidden');
              }
              this.closest('.grid__item').querySelector('.price').classList.remove("price--on-sale");
            }
            if(data.dataset.unitprice) {
              wbunitPrice.innerHTML = data.dataset.unitprice;
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
            if(data.dataset.unitvalue) {
              wbunitValue.innerHTML = data.dataset.unitvalue;
              this.closest('.grid__item').querySelector('.price').classList.add("price--on-sale");
            }
          }
        });
      });
      return;
    }

    const productForms = document.querySelectorAll(`#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`);
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  updateVariantStatuses() {

    const selectedOptionOneVariants = this.variantData.filter(variant => this.querySelector(':checked').value === variant.option1);
    const inputWrappers = [...this.querySelectorAll('.product_form_input')];
    inputWrappers.forEach((option, index) => {
      if (index === 0) return;
      const optionInputs = [...option.querySelectorAll('input[type="radio"], option')]
      const previousOptionSelected = inputWrappers[index - 1].querySelector(':checked').value;
      const availableOptionInputsValue = selectedOptionOneVariants.filter(variant => variant.available && variant[`option${ index }`] === previousOptionSelected).map(variantOption => variantOption[`option${ index + 1 }`]);
      this.setInputAvailability(optionInputs, availableOptionInputsValue)
    });
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach(input => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.innerText = input.getAttribute('value');
      } else {
        input.innerText = window.variantStrings.unavailable_with_option.replace('[value]', input.getAttribute('value'));
      }
    });
  }
  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector('pickup-availability');
    if (!pickUpAvailability) return;

    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute('available');
      pickUpAvailability.innerHTML = '';
    }
  }

  removeErrorMessage() {
    const section = this.closest('section');
    if (!section) return;

    const productForm = section.querySelector('product-form');
    if (productForm) productForm.handleErrorMessage();
  }

  renderProductInfo() {
    const requestedVariantId = this.currentVariant.id;
    let sectionId = this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section;

    if (this.dataset.layout == 'card') {
      fetch(`${this.dataset.url}?variant=${requestedVariantId}&section_id=${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`)
        .then((response) => response.text())
        .then((responseText) => {
          if (this.currentVariant.id !== requestedVariantId) return;
          this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          sectionId = `${sectionId}-${this.dataset.product}`;
          publish(PUB_SUB_EVENTS.variantChange, {data: {
              sectionId,
              html,
              variant: this.currentVariant
            }});

        })
      // this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
      return;
    }

    fetch(`${this.dataset.url}?variant=${requestedVariantId}&section_id=${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`)
        .then((response) => response.text())
        .then((responseText) => {
          // prevent unnecessary ui changes from abandoned selections
          if (this.currentVariant.id !== requestedVariantId) return;

          const html = new DOMParser().parseFromString(responseText, 'text/html')
          const destination = document.getElementById(`price-${this.dataset.section}`);
          const source = html.getElementById(`price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const skuSource = html.getElementById(`Sku-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const skuDestination = document.getElementById(`Sku-${this.dataset.section}`);
          const inventorySource = html.getElementById(`Inventory-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);
          const inventoryDestination = document.getElementById(`Inventory-${this.dataset.section}`);

          const volumePricingSource = html.getElementById(
            `Volume-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
          );

          const pricePerItemDestination = document.getElementById(`Price-Per-Item-${this.dataset.section}`);
          const pricePerItemSource = html.getElementById(`Price-Per-Item-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`);

          const volumePricingDestination = document.getElementById(`Volume-${this.dataset.section}`);
          const qtyRules = document.getElementById(`Quantity-Rules-${this.dataset.section}`);
          const volumeNote = document.getElementById(`Volume-Note-${this.dataset.section}`);

          if (volumeNote) volumeNote.classList.remove('hidden');
          if (volumePricingDestination) volumePricingDestination.classList.remove('hidden');
          if (qtyRules) qtyRules.classList.remove('hidden');

          if (source && destination) destination.innerHTML = source.innerHTML;
          if (inventorySource && inventoryDestination) inventoryDestination.innerHTML = inventorySource.innerHTML;
          if (skuSource && skuDestination) {
            skuDestination.innerHTML = skuSource.innerHTML;
            skuDestination.classList.toggle('visibility-hidden', skuSource.classList.contains('visibility-hidden'));
          }

          if (volumePricingSource && volumePricingDestination) {
            volumePricingDestination.innerHTML = volumePricingSource.innerHTML;
          }

          if (pricePerItemSource && pricePerItemDestination) {
            pricePerItemDestination.innerHTML = pricePerItemSource.innerHTML;
            pricePerItemDestination.classList.toggle('visibility-hidden', pricePerItemSource.classList.contains('visibility-hidden'));
          }

          const price = document.getElementById(`price-${this.dataset.section}`);

          if (price) price.classList.remove('hidden');

          if (inventoryDestination) inventoryDestination.classList.toggle('visibility-hidden', inventorySource.innerText === '');

          const addButtonUpdated = html.getElementById(`ProductSubmitButton-${sectionId}`);
          this.toggleAddButton(addButtonUpdated ? addButtonUpdated.hasAttribute('disabled') : true, window.variantStrings.soldOut);

          publish(PUB_SUB_EVENTS.variantChange, {data: {
              sectionId,
              html,
              variant: this.currentVariant
            }});
        });
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    // Variant in Product Card
    var selector = `product-form-${this.dataset.section}`;
    if (this.dataset.layout == 'card') {
      selector = `product-form-${this.dataset.section}-${this.dataset.product}`;
    }
    const productForm = document.getElementById(selector);
    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;
    if (disable) {
      addButton.setAttribute('disabled', 'disabled');
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute('disabled');
      addButtonText.textContent = window.variantStrings.addToCart;
    }
    if (!modifyClass) return;
  }

  setUnavailable() {
    // Variant in Product Card
    var selector = `product-form-${this.dataset.section}`;
    var priceSelector = `price-${this.dataset.section}`;
    var button = document.getElementById(`product-form-${this.dataset.section}`);
    if (this.dataset.layout == 'card') {
      selector = `product-form-${this.dataset.section}-${this.dataset.product}`;
      priceSelector = `price-${this.dataset.section}-${this.dataset.product}`;
      button = document.getElementById(`product-form-${this.dataset.section}-${this.dataset.product}`);
    }
    
    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`);
    const inventory = document.getElementById(`Inventory-${this.dataset.section}`);
    const sku = document.getElementById(`Sku-${this.dataset.section}`);

    if (!addButton) return;
    addButtonText.textContent = window.variantStrings.unavailable;
    // if (price) price.classList.add('visibility-hidden');
    if (inventory) inventory.classList.add('visibility-hidden');
    if (sku) sku.classList.add('visibility-hidden');
  }

  getVariantData() {
    this.variantData = this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }
}

customElements.define('variant-selects', VariantSelects);

class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach(input => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
      }
    });
  }

  updateOptions() {
    const fieldsets = Array.from(this.querySelectorAll('fieldset'));
    this.options = fieldsets.map((fieldset) => {
      return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;
    });
  }
}

customElements.define('variant-radios', VariantRadios);


// Webi collaps
class WebiCollapse extends HTMLElement {
  constructor() {
    super();
    var col = this.getElementsByClassName("toggle");
    Array.from(col).forEach((ele) => {
      ele.setAttribute('tabindex', '0');
      var content = ele.nextElementSibling;
      var defaultOpen = ele.classList.contains("active");
      if (content && !defaultOpen) {
        content.style.height = '0px';
        content.setAttribute('data-collapsed', 'true');
      }
      ele.addEventListener("click", this.onSectionClick.bind(this));
      ele.addEventListener('keydown', this.handleKeyDown.bind(this));
    });
  }
  handleKeyDown(event){
    if (event.keyCode === 13) {
      this.onSectionClick(event);
    }
  }
  onSectionClick(event) {
    event.currentTarget.classList.toggle("active");
    var content = event.currentTarget.nextElementSibling;
    var isCollapsed = content.getAttribute('data-collapsed') === 'true';
    if (isCollapsed) {
      this.expandSection(content);
      content.setAttribute('data-collapsed', 'false');
    } else {
      this.collapseSection(content);
    }
  }
  expandSection(element) {
    var sectionHeight = element.scrollHeight;
    element.style.height = sectionHeight + 'px';
    element.style.visibility = 'visible';
    element.addEventListener('transitionend', () => {
      element.removeEventListener('transitionend', this.expandSection);
      element.style.height = null;
      element.style.visibility = 'visible';
    });
    element.setAttribute('data-collapsed', 'false');
  }
  collapseSection(element) {
    var sectionHeight = element.scrollHeight;
    element.style.height = sectionHeight + 'px';
    element.offsetHeight;
  
    element.style.transition = 'height 0.3s ease';
    element.style.height = '0px';
    
    element.addEventListener('transitionend', () => {
      element.removeEventListener('transitionend', this.collapseSection);
      element.style.transition = '';
      element.style.height = '0px';
      element.style.visibility = 'hidden';
    });
    element.setAttribute('data-collapsed', 'true');
  }
}
customElements.define('webi-collapse', WebiCollapse);

// User js
class UserPopup extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.popUpClick.bind(this));
    document.addEventListener('click', this.closePopup.bind(this));
  }
  popUpClick(event) {
    event.stopPropagation();
    this.querySelector("#userdrop").classList.toggle("hidden");
  }
  closePopup(event) {
    const userPopup = this.querySelector("#userdrop");
    if (!userPopup.contains(event.target)) {
      userPopup.classList.add("hidden");
    }
  }
}
customElements.define('user-popup', UserPopup);

// Collection page load more
class LoadMore extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', this.loadMoreProducts.bind(this));
    this.next_url = document.getElementById('product-grid').dataset.nextUrl;
    this.loadMoreBtn = this.querySelector('.button');
  }
  async getNextPage() {
    try {
      let res = await fetch(this.next_url);
      return await res.text();
    } catch (error) {
      console.log(error);
    }
  }
  async loadMoreProducts() {
    const load_more_spinner = this.getElementsByClassName('load-more_spinner')[0];
    if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'none';
    load_more_spinner.style.display = 'block';
    let nextPage = await this.getNextPage();
    const parser = new DOMParser();
    const nextPageDoc = parser.parseFromString(nextPage, 'text/html');
    load_more_spinner.style.display = 'none';
    const productgrid = nextPageDoc.getElementById('product-grid');
    const new_products = productgrid.getElementsByClassName('grid__item');
    const new_url = productgrid.dataset.nextUrl;
    if (new_url) {
      if (this.loadMoreBtn) this.loadMoreBtn.style.display = 'inline-flex';
    }
    this.next_url = new_url;
    for (let i = 0; i < new_products.length; i++) {
      if(new_products[i].classList.contains('wbimgbnrblock')) continue;
      document.getElementById('product-grid').appendChild(new_products[i]);
    }
  }
}
customElements.define('load-more', LoadMore);

// on click remove content on video
document.querySelectorAll('.banner-content-remove').forEach((close) => {
  close.addEventListener('click', (event) => {
    const parentElement = event.currentTarget.closest('.video_banner_box');
    if (parentElement) {
      parentElement.remove();
    }
  });
});
 
// Variant popup
class WBCardVariant extends HTMLElement {
  constructor() {  
    super();
    const selectBtn = this.querySelector('.wb_select_btn');
    if(selectBtn) selectBtn.addEventListener('click', this.addClassToParent.bind(this));
    document.addEventListener('click', this.onFocusOut.bind(this))
  }
  onFocusOut(event){
    event.stopPropagation();
    if(this.contains(event.target)) return;
    const ele = this.querySelector('.parent-selected');
    if(ele){
      ele.classList.remove('parent-selected');
      ele.style='';  
    }
  }
  addClassToParent(event) {
    const wbparentElement = this.querySelector('.wbproductdes');
    const beforeinfo = wbparentElement.getBoundingClientRect().height;
    wbparentElement.classList.add('parent-selected');
    const afterinfo = wbparentElement.getBoundingClientRect().height;
    wbparentElement.style = 'margin-top: '+ (beforeinfo - afterinfo).toString() +'px;'; 
  }
}
customElements.define('wb-card-variant', WBCardVariant);   


// Verticle menu
class DesktopWebiMenu extends HTMLElement {
  constructor() {  
    super();
    const drop = this.dataset.drop ? this.dataset.drop : 'click';
    document.addEventListener('click', this.onFocusOut.bind(this));
    this.addEventListener('keydown', this.handleKeyDown.bind(this));
    this.querySelectorAll('li').forEach(ele =>{
      ele.addEventListener('keydown', this.handleLiKeyDown.bind(this));
      ele.addEventListener(drop, ()=>{
        this.onLiClick(ele);
      });
      if(drop == 'mouseover'){
        ele.addEventListener('mouseout', ()=>{
           this.closeLi();
        });
      }
    });
  }
  handleLiKeyDown(event){
    if (event.keyCode === 13) {
      if(event.target.classList.contains('menuclick')) event.target.classList.remove('menuclick');
      else this.onLiClick(event.target);
    }
  }
  handleKeyDown(event){
    if (event.keyCode === 13) {
      this.onFocusOut(event);
    }
  }
  onLiClick(ele){
    this.closeLi();
    ele.classList.add('menuclick');
  }
  closeLi(){
    this.querySelectorAll('li.menuclick').forEach((ele) =>{
      ele.classList.remove('menuclick');
    })
  }
  onFocusOut(event){
    event.stopPropagation();
    if(this.contains(event.target) && (!this.querySelector('#menu-drawer').contains(event.target))){ 
      if(this.classList.contains('open')) {
        this.classList.remove('open');
        this.closeLi();
      }
      else this.classList.add('open');
    }else if(!this.querySelector('#menu-drawer').contains(event.target)){
      this.classList.remove('open');
      this.closeLi();
    }
  }
}
customElements.define('desktop-webi-menu', DesktopWebiMenu);  


// Blog left sidebar Drawer Javascript
class ArticleToggle extends HTMLElement {
  constructor() {  
    super();
    this.sidebar = this.querySelector('.sidebar');
    this.toggleButton = this.querySelector('.toggle-button');
    this.closeBtn = this.querySelector('.sidebar-close');
    this.toggleButton.addEventListener('click', this.toggleSidebar.bind(this)); 
    this.closeBtn.addEventListener('click', this.closeSidebar.bind(this));
  }
  toggleSidebar() {
    this.sidebar.classList.add('active');
    document.body.classList.add("overflow-hidden");
  }
  closeSidebar() {
    this.sidebar.classList.remove('active');
    document.body.classList.remove("overflow-hidden");
  }
}
customElements.define('article-toggle', ArticleToggle); 


// counter section
class Counter extends HTMLElement {
  constructor() {
    super();
    this.section_counter = this.querySelector('#section_counter');
    this.counters = this.querySelectorAll('.counter-item .scroll_count');
    this.CounterObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some(v => v.isIntersecting)){
          this.counters.forEach((counter, index) => {
            const counterNumber = +counter.innerText;
            if(counterNumber == 0) return;
            counter.innerText = "0";
          });
          return;
        };
        let speed = 100;
        this.counters.forEach((counter, index) => {
          function UpdateCounter() {
            const targetNumber = +counter.dataset.target; 
            const initialNumber = +counter.innerText;
            const incPerCount = targetNumber / speed;
            if (initialNumber < targetNumber) {
              counter.innerText = Math.ceil(initialNumber + incPerCount);
              setTimeout(UpdateCounter, 15);
            }
            else {
              counter.innerText = targetNumber;
            }
          }
          UpdateCounter();
          if (counter.parentElement.style.animation) {
            counter.parentElement.style.animation = '';
          } else {
            counter.parentElement.style.animation = `slide-up 0.3s ease forwards ${
              index / this.counters.length + 0.5
            }s`;
          }
        });
      },
      {
        root: null,
        threshold: window.innerWidth > 768 ? 0.4 : 0.3,
      }
    );
    this.CounterObserver.observe(this.section_counter);
  }
}
customElements.define('c-counter', Counter);




// Variant hover
class VariantHover extends VariantSelects {
  constructor() { 
    super();
    const fieldsets = Array.from(this.querySelectorAll('fieldset label'));
    this.querySelectorAll('fieldset label').forEach((ele)=>{
      ele.addEventListener('mouseenter', this.onVariantChangeHover.bind(this));
      ele.addEventListener('click', this.onLabelClick.bind(this));
    }) 
  }

  onLabelClick(event){
    if(event.target.dataset.href){
      window.location.href = event.target.dataset.href;
    }
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach(input => {
      if (listOfAvailableOptions.includes(input.getAttribute('value'))) {
        input.classList.remove('disabled');
      } else {
        input.classList.add('disabled');
      }
    });
  }

  updateOptions(ele) {
    if(ele.attributes.for && this.querySelector('#'+ele.attributes.for.value)){
      this.querySelector('#'+ele.attributes.for.value).checked = true;
    }
    const fieldsets = Array.from(this.querySelectorAll('fieldset'));
    this.options = fieldsets.map((fieldset) => {
      return Array.from(fieldset.querySelectorAll('input')).find((radio) => radio.checked).value;
    });
  }

  updatelabelDataset(ele){
    let href = ele.dataset.href
    if(href.indexOf('?variant=') > -1){
      href = (href.substring(0, href.indexOf('?variant=')+9) + this.currentVariant.id)
    }else{
      href += ("?variant="+ this.currentVariant.id)
    }
    ele.dataset.href = href; 
  }

  onVariantChangeHover(event){
    this.updateOptions(event.target);
    this.updateMasterId();
    this.updatelabelDataset(event.target);
    this.updateMedia();
  }

  onVariantChange(){ // Don't dlt it
  }
}

customElements.define('variant-hover', VariantHover);