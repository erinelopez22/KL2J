// Lazily loaded (dynamic import) so this ~2MB dataset only downloads when a
// location autosuggest field is actually used (admin project form, or a
// public checklist "location" item), never eagerly in the main bundle.
let cached: string[] | null = null;
let loading: Promise<string[]> | null = null;

type NamedCode = { name: string };
type Province = NamedCode & { prov_code: string };
type CityMun = NamedCode & { prov_code: string; mun_code: string };
type Barangay = NamedCode & { mun_code: string };

export function loadPhilippineLocations(): Promise<string[]> {
  if (cached) return Promise.resolve(cached);
  if (loading) return loading;

  loading = import("phil-reg-prov-mun-brgy").then((mod) => {
    const lib = (mod as unknown as { default?: unknown }).default ?? mod;
    const { provinces, city_mun, barangays } = lib as {
      provinces: Province[];
      city_mun: CityMun[];
      barangays: Barangay[];
    };

    const provinceByCode = new Map(provinces.map((p) => [p.prov_code, p.name]));
    const munByCode = new Map(city_mun.map((m) => [m.mun_code, m]));

    const list = barangays.map((b) => {
      const mun = munByCode.get(b.mun_code);
      const province = mun ? provinceByCode.get(mun.prov_code) : undefined;
      return [b.name, mun?.name, province].filter(Boolean).join(", ");
    });

    cached = list;
    return list;
  });

  return loading;
}
