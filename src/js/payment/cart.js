import storage from '../service/storage';
import KEYS from '../constant/keys';
import {
  getProductPrice,
  getExchangeRates,
  getShippingFee,
  getConfigsFromServer,
} from '../service/api';
import { getCoinName } from '../common/utils/crypto';
import $ from 'jquery';
import { ORIGIN_PRODUCT_PRICE } from '../constant/payment';
// import { handleCountdown } from './util';

export default class Cart {
  constructor(container) {
    if (!container) {
      throw new Error('container not found');
    }
    this.price = 0;
    this.quantity = $('#order-quantity option:selected').val() || 1;
    this.cart = this.getCartFromLocalStorage();
    this.selectedCoinName =$('#crypto-payment-coin-name option:selected').val() ||'BTC';
    this.totalPrice = 0;
    this.parentContainer = container;
    this.container = this.parentContainer.querySelector('#cart-container');
    this.getPriceFromLocalStorage();
    this.getCoinExchangeRateFromServer();
    this.getPriceFromServer();
    // this.getSystemConfigsFromServer();
    this.init();
    this.getShippingFeeFromServer = this.getShippingFeeFromServer.bind(this);
  }

  init() {
    $('#order-quantity').on('change', () => {
      const selected = $('#order-quantity option:selected').val();
      this.quantity = selected;
      this.updateCart();
    });
  }

  getQuantity() {
    return this.quantity;
  }

  setQuantity(value) {
    this.quantity = value;
  }

  getPriceEle() {
    return $('#price');
  }

  saveCartToLocalStorage(cart) {
    try {
      storage.set(KEYS.CART_INFORMATION, JSON.stringify(cart));
    } catch {}
  }

  getCartFromLocalStorage() {
    let cart = {};
    try {
      cart = JSON.parse(storage.get(KEYS.CART_INFORMATION) || '{}');
    } catch {}
    return cart;
  }

  getPriceFromLocalStorage() {
    this.price = this.price || storage.get(KEYS.PRODUCT_PRICE);
  }

  savePriceToLocalStorage(price) {
    storage.set(KEYS.PRODUCT_PRICE, price);
  }

  getCart() {
    return this.cart;
  }

  getPrice() {
    return this.price;
  }

  setPrice(price) {
    console.log(`price`, price);
    this.price = price || this.price;
    this.savePriceToLocalStorage(price);
  }

  setSelectedCoinName(coinName) {
    this.selectedCoinName = coinName;
  }

  getCartElements() {
    if (!this.container) return {};
    const quantityEl = this.container.querySelector('#order-quantity');
    const subTotalPriceEl = this.container.querySelector('.sub-total-price');
    const totalPriceEl = this.container.querySelector('.total-price');
    const shippingPriceEl = this.container.querySelector('.shipping-price');
    const taxPriceEl = this.container.querySelector('.tax-price');
    const productPriceEl = this.container.querySelector('#price');
    const totalPriceInCryptoEl = this.container.querySelector(
      '#pay-with-crypto'
    );
    const cryptoPaymentGuideEl = this.container.querySelector(
      '.crypto-payment-guide'
    );
    const shippingTimeEl = this.container.querySelector('#shipping-time');

    const shippingExtraText = $('#extra-text-ship');

    return {
      quantityEl,
      subTotalPriceEl,
      totalPriceEl,
      shippingPriceEl,
      taxPriceEl,
      productPriceEl,
      totalPriceInCryptoEl,
      cryptoPaymentGuideEl,
      shippingExtraText,
      shippingTimeEl,
    };
  }

  getExchangeRates() {
    if (this.exchangeRates) return this.exchangeRates;
    try {
      return JSON.parse(storage.get(KEYS.COIN_FIAT_RATE) || '{}');
    } catch {}
    return {};
  }

  getTotalPriceInCryptoEls() {
    const { totalPriceInCryptoEl } = this.getCartElements();
    if (!totalPriceInCryptoEl) return {};
    const coinNameEl = totalPriceInCryptoEl.querySelector('.coin-name');
    const totalPriceEl = totalPriceInCryptoEl.querySelector('.total-price');
    return { coinNameEl, totalPriceEl };
  }

  showTotalPriceInCryptoEl() {
    const { totalPriceInCryptoEl } = this.getCartElements();
    if (!totalPriceInCryptoEl) return;
    totalPriceInCryptoEl.classList.remove('hidden');
  }

  hideTotalPriceInCryptoEl() {
    const { totalPriceInCryptoEl } = this.getCartElements();
    if (!totalPriceInCryptoEl) return;
    totalPriceInCryptoEl.classList.add('hidden');
  }

  showCryptoPaymentGuide() {
    const { cryptoPaymentGuideEl } = this.getCartElements();
    if (!cryptoPaymentGuideEl) return;
    cryptoPaymentGuideEl.classList.remove('hidden');
  }

  updateTotalPriceInCrypto() {
    const { coinNameEl, totalPriceEl } = this.getTotalPriceInCryptoEls();
    const exchangeRates = this.getExchangeRates();
    if (!this.selectedCoinName || !exchangeRates) return;
    const coinRate = exchangeRates[this.selectedCoinName.toLowerCase()];
    let totalAmountInCoin = this.totalPrice;

    if (coinRate) {
      totalAmountInCoin = this.totalPrice / coinRate;
    }

    let toFixedNumber = 0;
    switch (this.selectedCoinName.toLowerCase()) {
      case 'btc':
        toFixedNumber = 6;
        break;
      case 'eth':
      case 'bnb':
        toFixedNumber = 4;
        break;
    }

    if (coinNameEl)
      coinNameEl.innerText = getCoinName(this.selectedCoinName);
    if (totalPriceEl)
      totalPriceEl.innerText = `${totalAmountInCoin.toFixed(toFixedNumber)} ${
        this.selectedCoinName
      }`;
  }

  updateCart({
    price = this.getPrice(),
    shippingFee,
    tax,
    quantity = this.quantity,
    saveCart = false,
    country,
  } = {}) {
    const {
      // quantityEl,
      subTotalPriceEl,
      totalPriceEl,
      shippingPriceEl,
      taxPriceEl,
      productPriceEl,
      shippingExtraText,
    } = this.getCartElements();
    let _country = !!country ? country : $('#shipping-country').val();
    const currentCart = this.getCartFromLocalStorage();
    const checkFee =
      shippingFee != null ? shippingFee : currentCart.shippingFee;
    shippingFee =
      _country == 'US' || _country == 'VN' ? 0 : checkFee * quantity;
    tax = tax != null ? tax : currentCart.tax || 0;
    // quantity = quantity != null ? quantity : currentCart.quantity || 1;
    const subTotalPrice = quantity * price;
    const totalPrice = subTotalPrice + shippingFee;
    this.totalPrice = totalPrice;
    // quantity = quantityEl ? quantityEl.value : quantity;
    this.cart = {
      price,
      shippingFee: shippingFee / quantity,
      tax,
      quantity,
      totalPrice,
    };

    if (saveCart) {
      this.saveCartToLocalStorage(this.cart);
    }

    if (productPriceEl) productPriceEl.innerText = `$${price}`;
    if (subTotalPriceEl) subTotalPriceEl.innerText = `$${subTotalPrice}`;
    if (shippingPriceEl)
      shippingPriceEl.innerText = shippingFee ? `$${shippingFee}` : 'FREE';
    if (taxPriceEl) {
      if (tax > 0) {
        taxPriceEl.classList.add('show');
        taxPriceEl.innerText = tax;
      } else {
        taxPriceEl.classList.remove('show');
      }
    }
    if (totalPriceEl) totalPriceEl.innerText = `$${totalPrice}`;
    switch (_country) {
      case 'US':
      case 'VN': {
        shippingExtraText.text('');
        break;
      }
      default: {
        shippingExtraText.text(
          'This does not include any potential duties or taxes that will vary depending on your locality.'
        );
        break;
      }
    }
    this.updateTotalPriceInCrypto();
  }

  async getCoinExchangeRateFromServer() {
    try {
      const exchangeRates = await getExchangeRates();
      this.exchangeRates = exchangeRates;
      storage.set(KEYS.COIN_FIAT_RATE, JSON.stringify(exchangeRates));
    } catch {}
  }

  async getPriceFromServer() {
    try {
      if (!this.container) return;
      const { productPriceEl, shippingTimeEl } = this.getCartElements();
      const productPriceContainerEl = this.container.querySelector(
        '.product-price'
      );
      if (!productPriceEl || !shippingTimeEl || !productPriceContainerEl) {
        return;
      }
      const configs = await getConfigsFromServer();
      const { MinerShipInfo: shippingInDays } = configs;
      const productPrice = await getProductPrice();
      if (productPrice && productPrice < ORIGIN_PRODUCT_PRICE) {
        this.setPrice(productPrice);
        const originEl = this.container.querySelector('#origin-price');
        if (!originEl) {
          const newOriginEl = document.createElement('div');
          newOriginEl.classList.add('price');
          newOriginEl.id = 'origin-price';
          newOriginEl.innerText = `$${ORIGIN_PRODUCT_PRICE}`;
          productPriceContainerEl.prepend(newOriginEl);
        } else {
          originEl.innerText = `$${ORIGIN_PRODUCT_PRICE}`;
        }
      } else {
        this.setPrice(ORIGIN_PRODUCT_PRICE);
      }
      productPriceEl.innerText = `$${this.getPrice()}`;
      shippingTimeEl.innerText = `Ships ${shippingInDays || 'within 2 days'}`;
      // shippingTimeEl.innerText = `November 1 - November 15`;
      this.updateCart();
    } catch (error) {
      console.log(`error`, error);
    }
  }

  async getShippingFeeFromServer({ address, city, zip, state, country }) {
    const quantity = this.quantity;
    let shippingFee = 0;
    let tax = 0;

    try {
      const fee = await getShippingFee({ address, city, zip, state, country });
      if (fee) {
        const productPrice = fee.Price;
        this.setPrice(productPrice);
        shippingFee = fee.ShippingFee;
        tax = fee.Tax;
      }
    } catch {}

    this.updateCart({
      quantity,
      shippingFee,
      tax,
      saveCart: true,
      country,
    });
  }
}
