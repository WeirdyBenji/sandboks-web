import { useState } from 'react';
import { Calculator, TrendingUp, Info } from 'lucide-react';

interface ActivityType {
  label: string;
  category: string;
  rate: number;
  acreRate: number;
  allowance: number;
  vl: number;
}

const activityTypes: Record<string, ActivityType> = {
  sales: {
    label: 'Vente de marchandises (BIC)', //0.1
    category: 'BIC',
    rate: 0.123,
    acreRate: 0.062,
    allowance: 0.71,
    vl: 0.01,
  },
  services_bnc: {
    label: 'Prestations de services intellectuelles, autres (Développeurs, Designers) (BNC)', //0.2
    category: 'BNC',
    rate: 0.256,
    acreRate: 0.128,
    allowance: 0.34,
    vl: 0.022,
  },
  services_bic: {
    label: 'Prestations de services commerciales et artisanales (Prothésistes ongulaires, Vente press-on artisanaux) (BIC)', //0.3
    category: 'BIC',
    rate: 0.212,
    acreRate: 0.106,
    allowance: 0.50,
    vl: 0.017,
  },
  liberal: {
    label: 'Activités libérales (CIPAV)',
    category: 'BNC',
    rate: 0.232,
    acreRate: 0.134,
    allowance: 0.34,
    vl: 0.022,
  },
  immo: {
    label: 'Location de meublés',
    category: 'None',
    rate: 0.06,
    acreRate: 0.03,
    allowance: 0.30,
    vl: 0.01,
  },
};

function calculateIncomeTax(revenuImposable: number, parts = 1): number {
  const quotient = revenuImposable / parts;
  let impot = 0;

  const tranches = [
    { plafond: 11294, taux: 0 },
    { plafond: 28797, taux: 0.11 },
    { plafond: 82341, taux: 0.30 },
    { plafond: 177106, taux: 0.41 },
    { plafond: Infinity, taux: 0.45 }
  ];

  let revenuRestant = quotient;
  let basTranche = 0;

  for (const tranche of tranches) {
    const montantTranche = Math.min(revenuRestant, tranche.plafond - basTranche);

    if (montantTranche > 0) {
      impot += montantTranche * tranche.taux;
      revenuRestant -= montantTranche;
    }

    basTranche = tranche.plafond;

    if (revenuRestant <= 0) break;
  }

  return impot * parts;
}

function App() {
  const [amount, setAmount] = useState<string>('');
  const [tjm, setTjm] = useState<string>('');
  const [jh, setJh] = useState<string>('220');
  const [activityType, setActivityType] = useState<string>('services_bnc');
  const [acreLevel, setAcreLevel] = useState<'none' | '50' | '25'>('none');
  const [hasTva, setHasTva] = useState<boolean>(false);
  const [taxMode, setTaxMode] = useState<'vl' | 'ir'>('vl');

  const calculateResults = () => {
    const amountNum = parseFloat(amount) || 0;
    const tjmNum = parseFloat(tjm) || 0;
    const jhNum = parseFloat(jh) || 220;

    let finalAmount = amountNum;
    if (tjmNum > 0 && amountNum === 0) {
      finalAmount = tjmNum * jhNum;
    }
    const activity = activityTypes[activityType];
    const socialRate =
      acreLevel === '50' ? activity.acreRate :
        acreLevel === '25' ? activity.rate * 0.75 :
          activity.rate;

    const ht = hasTva ? finalAmount / 1.2 : finalAmount;
    const socialCharges = ht * socialRate;
    const netAfterCharges = ht - socialCharges;

    let deduction = 0;
    let deductionLabel = '';
    let taxAmount = 0;
    let superNet = netAfterCharges;

    if (taxMode === 'vl') {
      deduction = ht * activity.vl;
      deductionLabel = 'versementLibératoire';
      superNet = netAfterCharges - deduction;
    } else if (taxMode === 'ir') {
      const allowanceDeduction = ht * activity.allowance;
      const taxableIncome = ht - allowanceDeduction;
      taxAmount = calculateIncomeTax(taxableIncome);
      deduction = allowanceDeduction;
      deductionLabel = 'allowance';
      superNet = netAfterCharges - taxAmount;
    }

    const maxCharges = taxMode === 'vl' ? 0 : ht * activity.allowance - socialCharges;

    const effectiveAllowance = taxMode === 'vl' ? 0 : activity.allowance;

    return {
      ht: ht.toFixed(2),
      socialCharges: socialCharges.toFixed(2),
      socialRate: (socialRate * 100).toFixed(1),
      netAfterCharges: netAfterCharges.toFixed(2),
      allowance: activity.allowance,
      effectiveAllowance,
      vl: activity.vl,
      deduction: deduction.toFixed(2),
      deductionLabel: deductionLabel,
      taxAmount: taxAmount.toFixed(2),
      taxMode: taxMode,
      superNet: superNet.toFixed(2),
      maxCharges: Math.max(0, maxCharges).toFixed(2),
      category: activity.category,
    };
  };

  const results = calculateResults();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Calculator className="w-10 h-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-800">
              Simulateur Micro-Entreprise
            </h1>
          </div>
          <p className="text-gray-600 text-lg">
            Calculez votre revenu net à partir de votre chiffre d'affaires
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Paramètres
            </h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Montant encaissé (€)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (e.target.value && jh && jh !== '0') {
                      const calcTjm = parseFloat(e.target.value) / parseFloat(jh);
                      setTjm(calcTjm > 0 ? calcTjm.toFixed(2) : '');
                    } else {
                      setTjm('');
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-lg"
                  placeholder="1000"
                  step="0.01"
                />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-medium text-gray-600 mb-3">Ou calculer via TJM :</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      TJM (€)
                    </label>
                    <input
                      type="number"
                      value={tjm}
                      onChange={(e) => {
                        setTjm(e.target.value);
                        if (e.target.value && jh && jh !== '0') {
                          const calcAmount = parseFloat(e.target.value) * parseFloat(jh);
                          setAmount(calcAmount > 0 ? calcAmount.toFixed(2) : '');
                        } else {
                          setAmount('');
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="500"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      JH
                    </label>
                    <input
                      type="number"
                      value={jh}
                      onChange={(e) => {
                        setJh(e.target.value);
                        if (e.target.value && e.target.value !== '0') {
                          if (tjm && parseFloat(tjm) > 0) {
                            const calcAmount = parseFloat(tjm) * parseFloat(e.target.value);
                            setAmount(calcAmount.toFixed(2));
                          } else if (amount && parseFloat(amount) > 0) {
                            const calcTjm = parseFloat(amount) / parseFloat(e.target.value);
                            setTjm(calcTjm.toFixed(2));
                          }
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'activité
                </label>
                <select
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                >
                  {Object.entries(activityTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label} ({(value.allowance * 100).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Fiscalité
                </label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="radio"
                      id="vl"
                      name="tax-mode"
                      value="vl"
                      checked={taxMode === 'vl'}
                      onChange={(e) => setTaxMode(e.target.value as 'vl' | 'ir')}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="vl" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                      Versement libératoire
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="radio"
                      id="ir"
                      name="tax-mode"
                      value="ir"
                      checked={taxMode === 'ir'}
                      onChange={(e) => setTaxMode(e.target.value as 'vl' | 'ir')}
                      className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="ir" className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                      Impôt sur le revenu
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">ACRE</label>
                <div className="flex flex-col gap-2">
                  {([
                    { value: 'none', label: 'Sans ACRE' },
                    { value: '50', label: 'ACRE (−50%)' },
                    { value: '25', label: 'ACRE (−25%)' },
                  ] as const).map(({ value, label }) => (
                    <div key={value} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <input
                        type="radio"
                        id={`acre-${value}`}
                        name="acre-level"
                        value={value}
                        checked={acreLevel === value}
                        onChange={() => setAcreLevel(value)}
                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor={`acre-${value}`} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                        {label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="tva"
                  checked={hasTva}
                  onChange={(e) => setHasTva(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="tva" className="text-sm font-medium text-gray-700 cursor-pointer">
                  TVA incluse (20%)
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              Résultats
            </h2>

            <div className="space-y-4">
              {hasTva && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Montant HT</span>
                  <span className="text-lg font-semibold text-gray-800">
                    {results.ht} €
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">
                  Charges sociales ({results.socialRate}%)
                </span>
                <span className="text-lg font-semibold text-red-600">
                  - {results.socialCharges} €
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Net après charges</span>
                <span className="text-lg font-semibold text-gray-800">
                  {results.netAfterCharges} €
                </span>
              </div>

              {results.taxMode === 'vl' && parseFloat(results.deduction) > 0 && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">
                    Versement libératoire ({(results.vl * 100).toFixed(1)}%)
                  </span>
                  <span className="text-lg font-semibold text-red-600">
                    - {results.deduction} €
                  </span>
                </div>
              )}

              {results.taxMode === 'ir' && parseFloat(results.taxAmount) > 0 && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-gray-600">Impôt sur le revenu</span>
                  <span className="text-lg font-semibold text-red-600">
                    - {results.taxAmount} €
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 pb-3 bg-gradient-to-r from-green-50 to-emerald-50 -mx-6 px-6 mt-4 rounded-b-xl border-t-2 border-green-200">
                <span className="text-gray-800 font-semibold text-lg">
                  Super net
                </span>
                <span className="text-2xl font-bold text-green-600">
                  {results.superNet} €
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 pb-3 bg-amber-50 -mx-6 px-6 text-sm border-b border-amber-100">
                <span className="text-gray-700">
                  Charges optimales max
                </span>
                <span className="font-semibold text-amber-700">
                  {results.maxCharges} €
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 pb-3 bg-amber-50 -mx-6 px-6 rounded-b-xl text-sm">
                <span className="text-gray-700">
                  Abattement forfaitaire ({(results.effectiveAllowance * 100).toFixed(0)}%)
                </span>
                <span className="font-semibold text-amber-700">
                  {(parseFloat(results.ht) * results.effectiveAllowance).toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700 space-y-3">
              <p className="font-semibold text-gray-800">Informations importantes :</p>

              <div>
                <p className="font-medium text-gray-800 mb-1">Catégories d'activités :</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                  <li><span className="font-medium">BNC</span> : Développeurs freelance, designers, consultants</li>
                  <li><span className="font-medium">BIC</span> : Vente de produits, e-commerce, prothésistes ongulaires, vente de press-on nails</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Conditions et barèmes :</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                  <li><a href="#" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">ACRE (Aide aux Créateurs et Repreneurs d'Entreprise)</a> - Réduction de 50% des charges la 1ère année</li>
                  <li><a href="https://www.service-public.fr/professionnels-entreprises/vosdroits/F32919" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Versement libératoire (VL)</a> - Imposition forfaitaire selon l'activité</li>
                  <li><a href="https://www.service-public.fr/professionnels-entreprises/vosdroits/F32919" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Impôt sur le revenu (IR)</a> - Abattement forfaitaire selon l'activité</li>
                  <li><a href="https://www.economie.gouv.fr/entreprises/gerer-sa-micro-entreprise/micro-entreprises-quel-est-le-montant-de-vos-cotisations-sociales" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Cotisations sociales 2026</a> - Barème selon l'activité</li>
                </ul>
              </div>

              <div>
                <p className="font-medium text-gray-800 mb-1">Explications :</p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                  <li>Abattement : vente (71%), services BIC (50%), services/libéraux (34%)</li>
                  <li>Charges optimales max = abattement - charges sociales (limites de déductibilité)</li>
                  <li>Super net = Net après charges - Impôt sur le revenu ou VL</li>
                  <li>Moyenne de jours travaillés par an : FR 214 (prendre 220), US 235 (prendre 250)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
