import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  useIAP,
  type ExpoPurchaseError,
  type Purchase,
} from 'expo-iap';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState, Platform } from 'react-native';

import {
  PurchasesContext,
  REMOVE_ADS_PRODUCT_ID,
  type PurchaseStatus,
  type PurchasesContextValue,
  type RestorePurchaseResult,
} from '@/providers/purchases-context';

const ENTITLEMENT_CACHE_KEY = '@lottolens-ph/entitlements/remove-ads/v1';
const CONNECTION_GRACE_MS = 5_000;

function isRemoveAdsPurchase(purchase: Purchase): boolean {
  return (
    purchase.productId === REMOVE_ADS_PRODUCT_ID &&
    purchase.purchaseState === 'purchased'
  );
}

function messageForPurchaseError(error: ExpoPurchaseError): string {
  switch (error.code) {
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
      return 'Google Play Billing is unavailable on this device.';
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
      return 'The ad-free purchase is not available from Google Play yet.';
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ServiceTimeout:
      return 'Google Play could not be reached. Check your connection and try again.';
    default:
      return 'The purchase could not be completed. Please try again.';
  }
}

export function PurchasesProvider({ children }: PropsWithChildren) {
  const [adsRemoved, setAdsRemoved] = useState(false);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [productChecked, setProductChecked] = useState(false);
  const [status, setStatus] = useState<PurchaseStatus>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const persistEntitlement = useCallback(async (owned: boolean) => {
    setAdsRemoved(owned);
    try {
      await AsyncStorage.setItem(ENTITLEMENT_CACHE_KEY, owned ? 'true' : 'false');
    } catch {
      // The store remains authoritative even if the offline UI cache cannot be saved.
    }
  }, []);

  const acknowledgeIfNeeded = useCallback(async (purchase: Purchase) => {
    if (
      Platform.OS === 'android' &&
      'isAcknowledgedAndroid' in purchase &&
      purchase.isAcknowledgedAndroid === true
    ) {
      return;
    }
    await finishTransaction({ purchase, isConsumable: false });
  }, []);

  const syncEntitlement = useCallback(
    async (manual: boolean): Promise<RestorePurchaseResult> => {
      if (manual) {
        setRestoring(true);
        setStatus('restoring');
        setMessage(null);
      }

      try {
        const purchases = await getAvailablePurchases();
        const ownedPurchase = purchases.find(isRemoveAdsPurchase);
        const pendingPurchase = purchases.find(
          (purchase) =>
            purchase.productId === REMOVE_ADS_PRODUCT_ID &&
            purchase.purchaseState === 'pending',
        );

        if (ownedPurchase) {
          await persistEntitlement(true);
          try {
            await acknowledgeIfNeeded(ownedPurchase);
            setMessage(manual ? 'Your ad-free purchase was restored.' : null);
          } catch {
            setMessage(
              'Ad-free access is active. Google Play will confirm the transaction again later.',
            );
          }
          setStatus('purchased');
          return 'restored';
        }

        if (pendingPurchase) {
          await persistEntitlement(false);
          setStatus('pending');
          setMessage('Payment is pending. Ads will be removed after Google Play confirms it.');
          return 'not-found';
        }

        await persistEntitlement(false);
        setStatus('available');
        setMessage(manual ? 'No previous ad-free purchase was found for this Google account.' : null);
        return 'not-found';
      } catch {
        setStatus('unavailable');
        setMessage(
          manual
            ? 'Google Play could not check your purchases. Please try again.'
            : null,
        );
        return 'unavailable';
      } finally {
        setReady(true);
        if (manual) setRestoring(false);
      }
    },
    [acknowledgeIfNeeded, persistEntitlement],
  );

  const completePurchase = useCallback(
    async (purchase: Purchase) => {
      if (purchase.productId !== REMOVE_ADS_PRODUCT_ID) return;
      setPurchasing(false);

      if (purchase.purchaseState === 'pending') {
        setStatus('pending');
        setMessage('Payment is pending. Ads will be removed after Google Play confirms it.');
        return;
      }

      if (
        purchase.purchaseState !== 'purchased' ||
        (Platform.OS === 'android' && !purchase.purchaseToken)
      ) {
        setStatus('error');
        setMessage('Google Play has not confirmed this purchase yet.');
        return;
      }

      // Google Play is queried again at launch and resume. The local value is only an
      // offline UI cache; it is never granted from the old free preference.
      await persistEntitlement(true);
      setReady(true);
      setStatus('purchased');

      try {
        await acknowledgeIfNeeded(purchase);
        setMessage('Purchase complete. Advertisements are now removed.');
      } catch {
        setMessage(
          'Ad-free access is active. Google Play will confirm the transaction again later.',
        );
      }
    },
    [acknowledgeIfNeeded, persistEntitlement],
  );

  const handlePurchaseError = useCallback(
    (error: ExpoPurchaseError) => {
      setPurchasing(false);

      if (error.code === ErrorCode.UserCancelled) {
        setStatus('available');
        setMessage(null);
        return;
      }
      if (error.code === ErrorCode.Pending) {
        setStatus('pending');
        setMessage('Payment is pending. Ads will be removed after Google Play confirms it.');
        return;
      }
      if (
        error.code === ErrorCode.AlreadyOwned ||
        error.code === ErrorCode.DuplicatePurchase
      ) {
        void syncEntitlement(true);
        return;
      }

      setStatus('error');
      setMessage(messageForPurchaseError(error));
    },
    [syncEntitlement],
  );

  const {
    connected,
    products,
    fetchProducts,
    requestPurchase,
    reconnect,
  } = useIAP({
    onPurchaseSuccess: (purchase) => void completePurchase(purchase),
    onPurchaseError: handlePurchaseError,
    onError: () => {
      setStatus('unavailable');
    },
  });

  const removeAdsProduct = useMemo(
    () => products.find((product) => product.id === REMOVE_ADS_PRODUCT_ID),
    [products],
  );

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(ENTITLEMENT_CACHE_KEY)
      .then((cached) => {
        if (active) setAdsRemoved(cached === 'true');
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCacheLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!cacheLoaded || !connected) return;
    let active = true;

    void fetchProducts({ skus: [REMOVE_ADS_PRODUCT_ID], type: 'in-app' })
      .catch(() => {
        if (active) setMessage('The ad-free product could not be loaded from Google Play.');
      })
      .finally(() => {
        if (active) setProductChecked(true);
      });
    void Promise.resolve().then(() => syncEntitlement(false));

    return () => {
      active = false;
    };
  }, [cacheLoaded, connected, fetchProducts, syncEntitlement]);

  useEffect(() => {
    if (!cacheLoaded || connected || ready) return;
    const timeout = setTimeout(() => {
      setReady(true);
      setStatus(adsRemoved ? 'purchased' : 'unavailable');
      if (!adsRemoved) {
        setMessage('Google Play Billing could not be reached. Open the Play Store and try again.');
      }
    }, CONNECTION_GRACE_MS);
    return () => clearTimeout(timeout);
  }, [adsRemoved, cacheLoaded, connected, ready]);

  useEffect(() => {
    if (!connected) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void syncEntitlement(false);
    });
    return () => subscription.remove();
  }, [connected, syncEntitlement]);

  const purchaseRemoveAds = useCallback(async () => {
    if (adsRemoved || purchasing) return;
    setMessage(null);

    const storeConnected = connected || (await reconnect());
    if (!storeConnected) {
      setReady(true);
      setStatus('unavailable');
      setMessage('Google Play Billing is unavailable. Open the Play Store and try again.');
      return;
    }

    setPurchasing(true);
    setStatus('purchasing');
    try {
      await requestPurchase({
        request: {
          apple: { sku: REMOVE_ADS_PRODUCT_ID, quantity: 1 },
          google: { skus: [REMOVE_ADS_PRODUCT_ID] },
        },
        type: 'in-app',
      });
    } catch (error) {
      handlePurchaseError(error as ExpoPurchaseError);
    }
  }, [adsRemoved, connected, handlePurchaseError, purchasing, reconnect, requestPurchase]);

  const restoreRemoveAds = useCallback(async (): Promise<RestorePurchaseResult> => {
    if (restoring) return adsRemoved ? 'restored' : 'unavailable';

    const storeConnected = connected || (await reconnect());
    if (!storeConnected) {
      setReady(true);
      setStatus('unavailable');
      setMessage('Google Play Billing is unavailable. Open the Play Store and try again.');
      return 'unavailable';
    }
    return syncEntitlement(true);
  }, [adsRemoved, connected, reconnect, restoring, syncEntitlement]);

  const value = useMemo<PurchasesContextValue>(
    () => {
      const productUnavailable =
        productChecked && connected && !removeAdsProduct && !adsRemoved;
      return {
        ready,
        connected,
        adsRemoved,
        storePrice: removeAdsProduct?.displayPrice ?? null,
        canPurchase:
          ready &&
          connected &&
          productChecked &&
          Boolean(removeAdsProduct) &&
          !adsRemoved &&
          !purchasing &&
          !restoring,
        purchasing,
        restoring,
        status: productUnavailable ? 'unavailable' : status,
        message: productUnavailable
          ? 'The ad-free product is not active for this app in Google Play yet.'
          : message,
        purchaseRemoveAds,
        restoreRemoveAds,
      };
    },
    [
      adsRemoved,
      connected,
      productChecked,
      purchaseRemoveAds,
      purchasing,
      ready,
      removeAdsProduct,
      restoring,
      restoreRemoveAds,
      status,
      message,
    ],
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}
