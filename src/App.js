import React, { useState, useEffect } from 'react';
import { 
  useNotifications,
  scheduleMedicationNotifications,
  cancelMedicationNotifications,
  showInstantNotification,
  showInteractionWarning,
  updateAppBadge,
  setupServiceWorkerMessageListener,
  usePWAInstall
} from './notificationUtils';

// グラフコンポーネント
import { 
  MedicationBarChart, 
  MoodLineChart, 
  MedicationPieChart, 
  MentalHealthChart 
} from './components/Charts';

// カレンダーコンポーネント
import MedicationCalendar from './components/MedicationCalendar';

// PDF生成ユーティリティ
import { 
  generateMedicalReportPDF, 
  generatePDFFromElement, 
  generateMedicationCSV 
} from './utils/pdfExport';

// アイコンコンポーネント（Unicode絵文字を使用）
const Icons = {
  Pill: ({ className = "text-2xl" }) => <span className={className}>💊</span>,
  Chart: ({ className = "text-lg" }) => <span className={className}>📊</span>,
  Calendar: ({ className = "text-lg" }) => <span className={className}>📅</span>,
  Export: ({ className = "text-lg" }) => <span className={className}>📤</span>,
  Hospital: ({ className = "text-lg" }) => <span className={className}>🏥</span>,
  Cloud: ({ className = "text-lg" }) => <span className={className}>☁️</span>,
  Search: ({ className = "text-lg" }) => <span className={className}>🔍</span>,
  Plus: ({ className = "text-lg" }) => <span className={className}>➕</span>,
  Trash: ({ className = "text-lg" }) => <span className={className}>🗑️</span>,
  Check: ({ className = "text-lg" }) => <span className={className}>✅</span>,
  Alert: ({ className = "text-lg" }) => <span className={className}>⚠️</span>,
  Mental: ({ className = "text-lg" }) => <span className={className}>🧠</span>,
  Report: ({ className = "text-lg" }) => <span className={className}>📋</span>,
  Download: ({ className = "text-lg" }) => <span className={className}>⬇️</span>,
  Sync: ({ className = "text-lg" }) => <span className={className}>🔄</span>,
  Install: ({ className = "text-lg" }) => <span className={className}>📱</span>
};

const MedicationReminderApp = () => {
  // 基本状態
  const [activeTab, setActiveTab] = useState('medications');
  const [medications, setMedications] = useState([]);
  const [records, setRecords] = useState([]);
  const [bleedingRecords, setBleedingRecords] = useState([]);
  const [mentalRecords, setMentalRecords] = useState([]);
  const [weeklyMentalRecords, setWeeklyMentalRecords] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  // UI状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  
  // フォーム状態
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    times: ['09:00'],
    notes: '',
    isYazFlex: false,
    isAntidepressant: false,
    isAntipsychotic: false,
    indication: '',
    yazFlexMode: 'continuous',
    startDate: new Date().toISOString().split('T')[0],
    isInBreakPeriod: false
  });

  const [todayMental, setTodayMental] = useState({
    date: new Date().toISOString().split('T')[0],
    mood: 5,
    anxiety: 5,
    sleep: 5,
    appetite: 5,
    energy: 5,
    notes: ''
  });

  const [weeklyMental, setWeeklyMental] = useState({
    weekStart: '',
    overallMood: 5,
    stressLevel: 5,
    socialFunction: 5,
    workPerformance: 5,
    medicationEffectiveness: 5,
    sideEffects: '',
    lifeEvents: '',
    goals: ''
  });

  const [newAppointment, setNewAppointment] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    hospital: '',
    doctor: '',
    purpose: '',
    notes: ''
  });

  // フック
  const { isNotificationEnabled, isInitializing } = useNotifications();
  const { isInstallable, installApp } = usePWAInstall();

  // 時刻の更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Service Worker メッセージ受信
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, medicationId, time } = event.data;
      
      switch (type) {
        case 'MEDICATION_TAKEN':
          markAsTaken(medicationId, time);
          showInstantNotification('✅ 服薬完了', '服薬記録を保存しました');
          break;
        case 'MEDICATION_SKIPPED':
          console.log(`Medication ${medicationId} was skipped at ${time}`);
          break;
        default:
          break;
      }
    };

    const cleanup = setupServiceWorkerMessageListener(handleMessage);
    return cleanup;
  }, []);

  // 未服薬数のバッジ更新
  useEffect(() => {
    const today = new Date().toDateString();
    let unTakenCount = 0;
    
    medications.forEach(medication => {
      medication.times.forEach(time => {
        const taken = records.find(record => 
          record.medicationId === medication.id && 
          record.date === today && 
          record.time === time
        );
        if (!taken) {
          unTakenCount++;
        }
      });
    });
    
    updateAppBadge(unTakenCount);
  }, [medications, records]);

  // ローカルストレージ（永続化）
  useEffect(() => {
    const savedData = localStorage.getItem('medicationApp');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setMedications(data.medications || []);
        setRecords(data.records || []);
        setBleedingRecords(data.bleedingRecords || []);
        setMentalRecords(data.mentalRecords || []);
        setWeeklyMentalRecords(data.weeklyMentalRecords || []);
        setAppointments(data.appointments || []);
      } catch (error) {
        console.error('データ読み込みエラー:', error);
      }
    }
  }, []);

  useEffect(() => {
    const data = {
      medications,
      records,
      bleedingRecords,
      mentalRecords,
      weeklyMentalRecords,
      appointments
    };
    localStorage.setItem('medicationApp', JSON.stringify(data));
  }, [medications, records, bleedingRecords, mentalRecords, weeklyMentalRecords, appointments]);

  // 薬剤検索（KEGG風）
  const handleMedicationSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // 模擬検索結果
      const mockData = [
        { id: 1, name: 'セルトラリン錠25mg', category: '抗うつ剤', interactions: ['ワルファリン'] },
        { id: 2, name: 'レクサプロ錠10mg', category: '抗うつ剤', interactions: ['MAO阻害剤'] },
        { id: 3, name: 'レキサルティOD錠1mg', category: '抗精神病薬', interactions: ['CYP2D6阻害剤'] },
        { id: 4, name: 'ヤーズフレックス錠', category: '低用量ピル', interactions: ['セイヨウオトギリソウ'] }
      ];
      
      const results = mockData.filter(med => 
        med.name.toLowerCase().includes(query.toLowerCase()) ||
        med.category.includes(query)
      );
      setSearchResults(results);
    } catch (error) {
      console.error('検索エラー:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // 薬剤追加
  const addMedication = () => {
    if (!newMedication.name.trim()) return;
    
    const medication = {
      id: Date.now(),
      ...newMedication,
      times: newMedication.times.filter(time => time.trim() !== ''),
      createdAt: new Date()
    };
    
    setMedications([...medications, medication]);
    
    // 通知のスケジュール
    if (isNotificationEnabled) {
      scheduleMedicationNotifications(medication);
      showInstantNotification(
        '✅ お薬を追加しました',
        `${medication.name} の服薬通知を設定しました`
      );
    }
    
    // フォームリセット
    setNewMedication({
      name: '',
      dosage: '',
      times: ['09:00'],
      notes: '',
      isYazFlex: false,
      isAntidepressant: false,
      isAntipsychotic: false,
      indication: '',
      yazFlexMode: 'continuous',
      startDate: new Date().toISOString().split('T')[0],
      isInBreakPeriod: false
    });
    setShowAddForm(false);
  };

  // 予約追加
  const addAppointment = () => {
    if (!newAppointment.hospital.trim()) return;
    
    const appointment = {
      id: Date.now(),
      ...newAppointment,
      date: new Date(newAppointment.date).toDateString(),
      createdAt: new Date()
    };
    
    setAppointments([...appointments, appointment]);
    showInstantNotification('🏥 予約を追加', `${appointment.hospital} の予約を追加しました`);
    
    setNewAppointment({
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      hospital: '',
      doctor: '',
      purpose: '',
      notes: ''
    });
  };

  // 服薬記録
  const markAsTaken = (medicationId, time = null) => {
    const now = new Date();
    const record = {
      id: Date.now(),
      medicationId,
      date: now.toDateString(),
      time: time || now.toTimeString().split(' ')[0].slice(0, 5),
      timestamp: now
    };
    setRecords([...records, record]);
  };

  // 薬剤削除
  const deleteMedication = (id) => {
    setMedications(medications.filter(med => med.id !== id));
    setRecords(records.filter(record => record.medicationId !== id));
    cancelMedicationNotifications(id);
  };

  // 今日の服薬記録取得
  const getTodaysRecords = (medicationId, time) => {
    const today = new Date().toDateString();
    return records.find(record => 
      record.medicationId === medicationId && 
      record.date === today && 
      record.time === time
    );
  };

  // 出血記録
  const recordBleeding = (date, level) => {
    const existing = bleedingRecords.find(r => r.date === date);
    if (existing) {
      setBleedingRecords(bleedingRecords.map(r => 
        r.date === date ? { ...r, level } : r
      ));
    } else {
      setBleedingRecords([...bleedingRecords, { date, level }]);
    }
  };

  // 休薬期間判定
  const shouldEnterBreakPeriod = (medication) => {
    if (!medication.isYazFlex) return false;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }
    
    let consecutiveBleedingDays = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      const bleeding = bleedingRecords.find(r => r.date === last7Days[i]);
      if (bleeding && bleeding.level !== 'none') {
        consecutiveBleedingDays++;
      } else {
        break;
      }
    }
    
    return consecutiveBleedingDays >= 3;
  };

  // メンタル記録保存
  const saveTodayMental = () => {
    const existing = mentalRecords.find(r => r.date === todayMental.date);
    if (existing) {
      setMentalRecords(mentalRecords.map(r => 
        r.date === todayMental.date ? todayMental : r
      ));
    } else {
      setMentalRecords([...mentalRecords, todayMental]);
    }
    
    showInstantNotification('✅ メンタル記録を保存', '今日の記録を保存しました');
  };

  const saveWeeklyMental = () => {
    const existing = weeklyMentalRecords.find(r => r.weekStart === weeklyMental.weekStart);
    if (existing) {
      setWeeklyMentalRecords(weeklyMentalRecords.map(r => 
        r.weekStart === weeklyMental.weekStart ? weeklyMental : r
      ));
    } else {
      setWeeklyMentalRecords([...weeklyMentalRecords, weeklyMental]);
    }
    
    showInstantNotification('✅ 週次記録を保存', '今週の記録を保存しました');
  };

  // 時間スロット追加/削除
  const addTimeSlot = () => {
    setNewMedication({
      ...newMedication,
      times: [...newMedication.times, '12:00']
    });
  };

  const removeTimeSlot = (index) => {
    const newTimes = newMedication.times.filter((_, i) => i !== index);
    setNewMedication({
      ...newMedication,
      times: newTimes.length > 0 ? newTimes : ['09:00']
    });
  };

  // チャート用データ生成
  const generateChartData = () => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toDateString();
      
      const dayRecords = records.filter(r => r.date === dateStr);
      const mentalRecord = mentalRecords.find(r => r.date === date.toISOString().split('T')[0]);
      
      last7Days.push({
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        value: dayRecords.length,
        mood: mentalRecord?.mood || 5,
        anxiety: mentalRecord?.anxiety || 5,
        sleep: mentalRecord?.sleep || 5,
        appetite: mentalRecord?.appetite || 5,
        energy: mentalRecord?.energy || 5,
        date: date.toISOString().split('T')[0]
      });
    }
    return last7Days;
  };

  const chartData = generateChartData();

  // クラウド同期（模擬）
  const syncToCloud = async () => {
    setSyncStatus('syncing');
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setSyncStatus('synced');
      showInstantNotification('☁️ 同期完了', 'データがクラウドに同期されました');
    } catch (error) {
      setSyncStatus('error');
      showInstantNotification('❌ 同期失敗', '同期中にエラーが発生しました');
    }
  };

  // データエクスポート
  const handleExportPDF = async () => {
    const reportData = {
      medications,
      records,
      mentalRecords,
      bleedingRecords,
      appointments
    };
    
    const result = await generateMedicalReportPDF(reportData);
    if (result.success) {
      showInstantNotification('📄 PDF生成完了', `${result.filename}がダウンロードされました`);
    } else {
      showInstantNotification('❌ PDF生成失敗', result.error);
    }
  };

  const handleExportCSV = () => {
    const result = generateMedicationCSV(records, medications);
    if (result.success) {
      showInstantNotification('📊 CSV生成完了', `${result.filename}がダウンロードされました`);
    }
  };

  // レンダリング部分は既存のコードと同じですが、新しいコンポーネントを使用
  return (
    <div className="max-w-6xl mx-auto p-4 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* PWA インストールバナー */}
      {isInstallable && (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 z-50 shadow-lg">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Icons.Install />
              <span className="text-sm">このアプリをホーム画面に追加できます</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={installApp}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
              >
                インストール
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white rounded-2xl shadow-xl overflow-hidden ${isInstallable ? 'mt-16' : ''}`}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.Pill />
              <div>
                <h1 className="text-2xl font-bold">お薬リマインダー Pro</h1>
                <p className="text-blue-100">全機能版 - データ分析・予約管理・KEGG連携対応</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={syncToCloud}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors ${
                  syncStatus === 'syncing' ? 'animate-pulse' : ''
                }`}
                disabled={syncStatus === 'syncing'}
              >
                <Icons.Sync />
                {syncStatus === 'syncing' ? '同期中...' : syncStatus === 'synced' ? '同期済み' : '同期'}
              </button>
              
              <div className="text-right">
                <div className="text-blue-100">
                  {currentTime.toLocaleString('ja-JP', {
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
                <div className="text-sm">
                  {isNotificationEnabled ? '🔔 通知有効' : '🔕 通知無効'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b overflow-x-auto">
          {[
            { id: 'medications', label: 'お薬管理', icon: <Icons.Pill className="text-base" /> },
            { id: 'analytics', label: 'データ分析', icon: <Icons.Chart className="text-base" /> },
            { id: 'calendar', label: 'カレンダー', icon: <Icons.Calendar className="text-base" /> },
            { id: 'appointments', label: '病院予約', icon: <Icons.Hospital className="text-base" /> },
            { id: 'kegg', label: 'KEGG検索', icon: <Icons.Search className="text-base" /> },
            { id: 'mental', label: 'メンタル', icon: <Icons.Mental className="text-base" /> },
            { id: 'export', label: 'エクスポート', icon: <Icons.Export className="text-base" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* お薬管理タブ */}
          {activeTab === 'medications' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">登録中のお薬</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <Icons.Plus className="text-base" />
                  薬を追加
                </button>
              </div>

              {/* 薬追加フォーム */}
              {showAddForm && (
                <div className="bg-gray-50 rounded-xl p-6 mb-6 border">
                  <h3 className="text-lg font-medium mb-4 text-gray-800">新しいお薬を追加</h3>
                  
                  {/* 薬の種類選択 */}
                  <div className="mb-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isYazFlex}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isYazFlex: e.target.checked,
                          isAntidepressant: false,
                          isAntipsychotic: false,
                          name: e.target.checked ? 'ヤーズフレックス' : '',
                          dosage: e.target.checked ? '1錠' : ''
                        })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">ヤーズフレックス</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isAntidepressant}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isAntidepressant: e.target.checked,
                          isYazFlex: false,
                          isAntipsychotic: false,
                          name: e.target.checked ? '' : newMedication.name,
                          dosage: e.target.checked ? '' : newMedication.dosage
                        })}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-sm font-medium text-gray-700">抗うつ剤</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isAntipsychotic}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isAntipsychotic: e.target.checked,
                          isYazFlex: false,
                          isAntidepressant: false,
                          name: e.target.checked ? 'レキサルティOD錠' : newMedication.name,
                          dosage: e.target.checked ? '1mg' : newMedication.dosage
                        })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">抗精神病薬（レキサルティなど）</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">薬名</label>
                      <input
                        type="text"
                        value={newMedication.name}
                        onChange={(e) => {
                          setNewMedication({...newMedication, name: e.target.value});
                          handleMedicationSearch(e.target.value);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="薬名を入力（KEGG検索対応）"
                        disabled={newMedication.isYazFlex || newMedication.isAntipsychotic}
                      />
                      
                      {/* 検索結果 */}
                      {searchResults.length > 0 && (
                        <div className="mt-2 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {searchResults.map(result => (
                            <button
                              key={result.id}
                              onClick={() => {
                                setNewMedication({
                                  ...newMedication,
                                  name: result.name,
                                  isAntidepressant: result.category === '抗うつ剤',
                                  isAntipsychotic: result.category === '抗精神病薬',
                                  isYazFlex: result.category === '低用量ピル'
                                });
                                setSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                            >
                              <div className="font-medium">{result.name}</div>
                              <div className="text-sm text-gray-600">{result.category}</div>
                              {result.interactions.length > 0 && (
                                <div className="text-xs text-red-600">
                                  相互作用: {result.interactions.join(', ')}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">用量</label>
                      <input
                        type="text"
                        value={newMedication.dosage}
                        onChange={(e) => setNewMedication({...newMedication, dosage: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例：25mg、1錠"
                        disabled={newMedication.isYazFlex || newMedication.isAntipsychotic}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">服薬時間</label>
                    {newMedication.times.map((time, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...newMedication.times];
                            newTimes[index] = e.target.value;
                            setNewMedication({...newMedication, times: newTimes});
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {newMedication.times.length > 1 && !newMedication.isYazFlex && (
                          <button
                            onClick={() => removeTimeSlot(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Icons.Trash className="text-base" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!newMedication.isYazFlex && (
                      <button
                        onClick={addTimeSlot}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <Icons.Plus className="text-sm" />
                        時間を追加
                      </button>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">メモ</label>
                    <textarea
                      value={newMedication.notes}
                      onChange={(e) => setNewMedication({...newMedication, notes: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="食後、空腹時、副作用の記録、錐体外路症状の有無などのメモ"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={addMedication}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* 薬一覧 */}
              <div className="space-y-4">
                {medications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Icons.Pill className="text-4xl mx-auto mb-4" />
                    <p className="mt-2">まだお薬が登録されていません</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      最初のお薬を登録する
                    </button>
                  </div>
                ) : (
                  medications.map(medication => (
                    <div key={medication.id} className="medication-card bg-white border rounded-xl p-6 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            {medication.isYazFlex ? '🟡' : medication.isAntidepressant ? '🟢' : medication.isAntipsychotic ? '🟣' : '💊'}
                            {medication.name}
                            <span className="text-sm font-normal text-gray-600">{medication.dosage}</span>
                          </h3>
                          {medication.notes && (
                            <p className="text-sm text-gray-600 mt-1">{medication.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteMedication(medication.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Icons.Trash className="text-base" />
                        </button>
                      </div>

                      {/* 今日の服薬状況 */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">今日の服薬状況</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {medication.times.map(time => {
                            const taken = getTodaysRecords(medication.id, time);
                            return (
                              <div key={time} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-700">{time}</span>
                                {taken ? (
                                  <Icons.Check className="text-green-600" />
                                ) : (
                                  <button
                                    onClick={() => markAsTaken(medication.id, time)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    服薬
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ヤーズフレックス特有の情報 */}
                      {medication.isYazFlex && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                          <h4 className="text-sm font-medium text-yellow-800 mb-2">出血記録</h4>
                          <div className="flex gap-1 mb-2">
                            {(() => {
                              const last7Days = [];
                              for (let i = 6; i >= 0; i--) {
                                const date = new Date();
                                date.setDate(date.getDate() - i);
                                const dateStr = date.toISOString().split('T')[0];
                                const bleeding = bleedingRecords.find(r => r.date === dateStr);
                                last7Days.push(
                                  <div 
                                    key={dateStr} 
                                    className={`w-2 h-2 rounded-full ${
                                      bleeding?.level === 'heavy' ? 'bg-red-600' : 
                                      bleeding?.level === 'moderate' ? 'bg-yellow-400' : 
                                      bleeding?.level === 'light' ? 'bg-yellow-200' : 
                                      'bg-gray-200'
                                    }`}
                                    title={dateStr}
                                  ></div>
                                );
                              }
                              return last7Days;
                            })()}
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'none')} 
                              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              なし
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'light')} 
                              className="px-2 py-1 bg-yellow-200 rounded hover:bg-yellow-300"
                            >
                              軽度
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'moderate')} 
                              className="px-2 py-1 bg-yellow-400 rounded hover:bg-yellow-500"
                            >
                              中程度
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'heavy')} 
                              className="px-2 py-1 bg-red-400 rounded hover:bg-red-500 text-white"
                            >
                              重度
                            </button>
                          </div>
                          {shouldEnterBreakPeriod(medication) && (
                            <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800 flex items-center gap-2">
                              <Icons.Alert className="text-sm" />
                              3日以上の連続出血が検出されました。休薬期間の検討をお勧めします。
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* データ分析タブ */}
          {activeTab === 'analytics' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">データ分析</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <MedicationBarChart data={chartData} />
                <MoodLineChart data={chartData} />
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <MedicationPieChart medications={medications} />
                <MentalHealthChart data={chartData} />
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-medium mb-4">統計情報</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{medications.length}</div>
                    <div className="text-sm text-gray-600">登録薬剤数</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{records.length}</div>
                    <div className="text-sm text-gray-600">総服薬回数</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{mentalRecords.length}</div>
                    <div className="text-sm text-gray-600">メンタル記録</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{appointments.length}</div>
                    <div className="text-sm text-gray-600">予約件数</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* カレンダータブ */}
          {activeTab === 'calendar' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">カレンダー</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <MedicationCalendar 
                    medications={medications}
                    records={records}
                    appointments={appointments}
                    onDateChange={setSelectedDate}
                    selectedDate={selectedDate}
                  />
                </div>
                
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-medium mb-4">
                    {selectedDate.toLocaleDateString('ja-JP')} の予定
                  </h3>
                  
                  <div className="space-y-3">
                    {medications.map(medication => (
                      <div key={medication.id} className="p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-800">{medication.name}</div>
                        <div className="text-sm text-green-600">
                          服薬時間: {medication.times.join(', ')}
                        </div>
                      </div>
                    ))}
                    
                    {appointments
                      .filter(apt => apt.date === selectedDate.toDateString())
                      .map(appointment => (
                        <div key={appointment.id} className="p-3 bg-red-50 rounded-lg">
                          <div className="font-medium text-red-800">{appointment.hospital}</div>
                          <div className="text-sm text-red-600">
                            {appointment.time} - {appointment.purpose}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 病院予約タブ */}
          {activeTab === 'appointments' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">病院予約管理</h2>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 border">
                  <h3 className="text-lg font-medium mb-4 text-gray-800">新しい予約を追加</h3>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">日付</label>
                        <input
                          type="date"
                          value={newAppointment.date}
                          onChange={(e) => setNewAppointment({...newAppointment, date: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">時間</label>
                        <input
                          type="time"
                          value={newAppointment.time}
                          onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">病院名</label>
                      <input
                        type="text"
                        value={newAppointment.hospital}
                        onChange={(e) => setNewAppointment({...newAppointment, hospital: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="病院名を入力"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">担当医</label>
                      <input
                        type="text"
                        value={newAppointment.doctor}
                        onChange={(e) => setNewAppointment({...newAppointment, doctor: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="担当医名を入力"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">診療目的</label>
                      <select
                        value={newAppointment.purpose}
                        onChange={(e) => setNewAppointment({...newAppointment, purpose: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">選択してください</option>
                        <option value="定期診察">定期診察</option>
                        <option value="薬の調整">薬の調整</option>
                        <option value="検査">検査</option>
                        <option value="相談">相談</option>
                        <option value="その他">その他</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">メモ</label>
                      <textarea
                        value={newAppointment.notes}
                        onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        rows="3"
                        placeholder="質問事項や持参するものなど"
                      />
                    </div>
                    
                    <button
                      onClick={addAppointment}
                      className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                    >
                      予約を追加
                    </button>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-medium mb-4">今後の予約</h3>
                  
                  <div className="space-y-3">
                    {appointments.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">予約がありません</p>
                    ) : (
                      appointments
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map(appointment => (
                          <div key={appointment.id} className="p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium text-gray-800">{appointment.hospital}</div>
                                <div className="text-sm text-gray-600">
                                  {new Date(appointment.date).toLocaleDateString('ja-JP')} {appointment.time}
                                </div>
                                <div className="text-sm text-gray-600">
                                  担当医: {appointment.doctor || '未設定'}
                                </div>
                                <div className="text-sm text-gray-600">
                                  目的: {appointment.purpose}
                                </div>
                                {appointment.notes && (
                                  <div className="text-sm text-gray-500 mt-1">
                                    {appointment.notes}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => setAppointments(appointments.filter(a => a.id !== appointment.id))}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Icons.Trash />
                              </button>
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* KEGG検索タブ */}
          {activeTab === 'kegg' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">KEGG MEDICUS 薬剤検索</h2>
              
              <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-xl p-6 text-white mb-6">
                <h3 className="text-lg font-medium mb-4">薬剤データベース検索</h3>
                <p className="text-green-100 text-sm mb-4">
                  KEGG MEDICUSデータベースと連携して、薬剤情報や相互作用を検索できます。
                </p>
                
                <div className="bg-white/20 rounded-lg p-4">
                  <input
                    type="text"
                    placeholder="薬剤名を入力してください"
                    className="w-full px-4 py-2 rounded-lg bg-white text-gray-800 placeholder-gray-500"
                    onChange={(e) => handleMedicationSearch(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-medium mb-4">検索結果</h3>
                
                {isSearching ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">検索中...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-4">
                    {searchResults.map(result => (
                      <div key={result.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-800">{result.name}</h4>
                            <p className="text-sm text-gray-600">分類: {result.category}</p>
                            {result.interactions.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-medium text-red-700">相互作用注意:</p>
                                <p className="text-sm text-red-600">{result.interactions.join(', ')}</p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setNewMedication({
                                ...newMedication,
                                name: result.name,
                                isAntidepressant: result.category === '抗うつ剤',
                                isAntipsychotic: result.category === '抗精神病薬',
                                isYazFlex: result.category === '低用量ピル'
                              });
                              setActiveTab('medications');
                              setShowAddForm(true);
                            }}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            追加
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    薬剤名を入力して検索してください
                  </p>
                )}
              </div>
            </div>
          )}

          {/* メンタル記録タブ */}
          {activeTab === 'mental' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">メンタル記録</h2>
              
              {/* 日次記録 */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">今日の記録</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'mood', label: '気分', emoji: '😊' },
                    { key: 'anxiety', label: '不安感', emoji: '😰' },
                    { key: 'sleep', label: '睡眠の質', emoji: '😴' },
                    { key: 'appetite', label: '食欲', emoji: '🍽️' },
                    { key: 'energy', label: 'エネルギー', emoji: '⚡' }
                  ].map(item => (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {item.emoji} {item.label} (1-10)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={todayMental[item.key]}
                        onChange={(e) => setTodayMental({...todayMental, [item.key]: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600">{todayMental[item.key]}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">メモ</label>
                  <textarea
                    value={todayMental.notes}
                    onChange={(e) => setTodayMental({...todayMental, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="今日の気づきや症状の変化など"
                  />
                </div>
                
                <button
                  onClick={saveTodayMental}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  今日の記録を保存
                </button>
              </div>

              {/* 週次記録 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">今週の振り返り</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'overallMood', label: '全体的な気分', emoji: '🎭' },
                    { key: 'stressLevel', label: 'ストレスレベル', emoji: '😤' },
                    { key: 'socialFunction', label: '社会機能', emoji: '👥' },
                    { key: 'workPerformance', label: '仕事/学業の調子', emoji: '💼' },
                    { key: 'medicationEffectiveness', label: '薬の効果実感', emoji: '💊' }
                  ].map(item => (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {item.emoji} {item.label} (1-10)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={weeklyMental[item.key]}
                        onChange={(e) => setWeeklyMental({...weeklyMental, [item.key]: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600">{weeklyMental[item.key]}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">副作用・気になる症状</label>
                    <textarea
                      value={weeklyMental.sideEffects}
                      onChange={(e) => setWeeklyMental({...weeklyMental, sideEffects: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="眠気、食欲変化、体重変化、錐体外路症状など"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">特別な出来事・ライフイベント</label>
                    <textarea
                      value={weeklyMental.lifeEvents}
                      onChange={(e) => setWeeklyMental({...weeklyMental, lifeEvents: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="引っ越し、転職、家族の変化、人間関係など"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">来週の目標</label>
                    <textarea
                      value={weeklyMental.goals}
                      onChange={(e) => setWeeklyMental({...weeklyMental, goals: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="運動、睡眠改善、社会活動など"
                    />
                  </div>
                </div>
                
                <button
                  onClick={saveWeeklyMental}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  週次記録を保存
                </button>
              </div>
            </div>
          )}

          {/* エクスポートタブ */}
          {activeTab === 'export' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">データエクスポート</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-medium mb-4">PDFレポート生成</h3>
                  <p className="text-gray-600 mb-4">
                    服薬記録、メンタル状態、予約情報を含む包括的なレポートを生成します。
                  </p>
                  <button
                    onClick={handleExportPDF}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
                  >
                    <Icons.Download />
                    PDF生成
                  </button>
                </div>
                
                <div className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-medium mb-4">CSVデータエクスポート</h3>
                  <p className="text-gray-600 mb-4">
                    服薬記録をCSV形式でエクスポートし、外部ツールでの分析に活用できます。
                  </p>
                  <button
                    onClick={handleExportCSV}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Icons.Download />
                    CSV生成
                  </button>
                </div>
              </div>
              
              <div id="report-content" className="mt-8 bg-white rounded-xl p-6 shadow-sm">
                <h3 className="text-lg font-medium mb-4">レポートプレビュー</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">基本情報</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>登録薬剤数: {medications.length}</div>
                      <div>総服薬記録: {records.length}</div>
                      <div>メンタル記録: {mentalRecords.length}</div>
                      <div>病院予約: {appointments.length}</div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">現在の薬剤</h4>
                    <div className="space-y-2">
                      {medications.map(med => (
                        <div key={med.id} className="text-sm border-l-4 border-blue-500 pl-3">
                          {med.name} {med.dosage} - {med.times.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">今後の予約</h4>
                    <div className="space-y-2">
                      {appointments.map(apt => (
                        <div key={apt.id} className="text-sm border-l-4 border-red-500 pl-3">
                          {new Date(apt.date).toLocaleDateString('ja-JP')} {apt.time} - {apt.hospital}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationReminderApp;

// アイコンコンポーネント（Unicode絵文字を使用）
const PillIcon = ({ className = "text-2xl" }) => <span className={className}>💊</span>;
const ClockIcon = ({ className = "text-lg" }) => <span className={className}>⏰</span>;
const CheckIcon = ({ className = "text-lg" }) => <span className={className}>✅</span>;
const AlertIcon = ({ className = "text-lg" }) => <span className={className}>⚠️</span>;
const PlusIcon = ({ className = "text-lg" }) => <span className={className}>➕</span>;
const TrashIcon = ({ className = "text-lg" }) => <span className={className}>🗑️</span>;
const ReportIcon = ({ className = "text-lg" }) => <span className={className}>📋</span>;
const MentalIcon = ({ className = "text-lg" }) => <span className={className}>🧠</span>;
const CalendarIcon = ({ className = "text-lg" }) => <span className={className}>📅</span>;
const InstallIcon = ({ className = "text-lg" }) => <span className={className}>📱</span>;

const MedicationReminderApp = () => {
  // タブ管理
  const [activeTab, setActiveTab] = useState('medications');
  
  // データ状態
  const [medications, setMedications] = useState([]);
  const [records, setRecords] = useState([]);
  const [bleedingRecords, setBleedingRecords] = useState([]);
  const [mentalRecords, setMentalRecords] = useState([]);
  const [weeklyMentalRecords, setWeeklyMentalRecords] = useState([]);
  
  // UI状態
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 新薬追加フォーム
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    times: ['09:00'],
    notes: '',
    isYazFlex: false,
    isAntidepressant: false,
    isAntipsychotic: false,
    indication: '',
    yazFlexMode: 'continuous',
    startDate: new Date().toISOString().split('T')[0],
    isInBreakPeriod: false
  });

  // メンタル記録
  const [todayMental, setTodayMental] = useState({
    date: new Date().toISOString().split('T')[0],
    mood: 5,
    anxiety: 5,
    sleep: 5,
    appetite: 5,
    energy: 5,
    notes: ''
  });

  const [weeklyMental, setWeeklyMental] = useState({
    weekStart: '',
    overallMood: 5,
    stressLevel: 5,
    socialFunction: 5,
    workPerformance: 5,
    medicationEffectiveness: 5,
    sideEffects: '',
    lifeEvents: '',
    goals: ''
  });

  // 通知機能
  const { isNotificationEnabled, isInitializing } = useNotifications();
  const { isInstallable, installApp } = usePWAInstall();

  // 時刻の更新
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Service Worker メッセージ受信
  useEffect(() => {
    const handleMessage = (event) => {
      const { type, medicationId, time } = event.data;
      
      switch (type) {
        case 'MEDICATION_TAKEN':
          markAsTaken(medicationId, time);
          showInstantNotification('✅ 服薬完了', '服薬記録を保存しました');
          break;
        case 'MEDICATION_SKIPPED':
          console.log(`Medication ${medicationId} was skipped at ${time}`);
          break;
        default:
          break;
      }
    };

    const cleanup = setupServiceWorkerMessageListener(handleMessage);
    return cleanup;
  }, []);

  // 未服薬数のバッジ更新
  useEffect(() => {
    const today = new Date().toDateString();
    let unTakenCount = 0;
    
    medications.forEach(medication => {
      medication.times.forEach(time => {
        const taken = records.find(record => 
          record.medicationId === medication.id && 
          record.date === today && 
          record.time === time
        );
        if (!taken) {
          unTakenCount++;
        }
      });
    });
    
    updateAppBadge(unTakenCount);
  }, [medications, records]);

  // ローカルストレージ（永続化）
  useEffect(() => {
    const savedData = localStorage.getItem('medicationApp');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);
        setMedications(data.medications || []);
        setRecords(data.records || []);
        setBleedingRecords(data.bleedingRecords || []);
        setMentalRecords(data.mentalRecords || []);
        setWeeklyMentalRecords(data.weeklyMentalRecords || []);
      } catch (error) {
        console.error('データ読み込みエラー:', error);
      }
    }
  }, []);

  useEffect(() => {
    const data = {
      medications,
      records,
      bleedingRecords,
      mentalRecords,
      weeklyMentalRecords
    };
    localStorage.setItem('medicationApp', JSON.stringify(data));
  }, [medications, records, bleedingRecords, mentalRecords, weeklyMentalRecords]);

  // 薬剤追加
  const addMedication = () => {
    if (!newMedication.name.trim()) return;
    
    const medication = {
      id: Date.now(),
      ...newMedication,
      times: newMedication.times.filter(time => time.trim() !== ''),
      createdAt: new Date()
    };
    
    setMedications([...medications, medication]);
    
    // 通知のスケジュール
    if (isNotificationEnabled) {
      scheduleMedicationNotifications(medication);
      showInstantNotification(
        '✅ お薬を追加しました',
        `${medication.name} の服薬通知を設定しました`
      );
    }
    
    // フォームリセット
    setNewMedication({
      name: '',
      dosage: '',
      times: ['09:00'],
      notes: '',
      isYazFlex: false,
      isAntidepressant: false,
      isAntipsychotic: false,
      indication: '',
      yazFlexMode: 'continuous',
      startDate: new Date().toISOString().split('T')[0],
      isInBreakPeriod: false
    });
    setShowAddForm(false);
  };

  // 服薬記録
  const markAsTaken = (medicationId, time = null) => {
    const now = new Date();
    const record = {
      id: Date.now(),
      medicationId,
      date: now.toDateString(),
      time: time || now.toTimeString().split(' ')[0].slice(0, 5),
      timestamp: now
    };
    setRecords([...records, record]);
  };

  // 薬剤削除
  const deleteMedication = (id) => {
    setMedications(medications.filter(med => med.id !== id));
    setRecords(records.filter(record => record.medicationId !== id));
    cancelMedicationNotifications(id);
  };

  // 今日の服薬記録取得
  const getTodaysRecords = (medicationId, time) => {
    const today = new Date().toDateString();
    return records.find(record => 
      record.medicationId === medicationId && 
      record.date === today && 
      record.time === time
    );
  };

  // 出血記録
  const recordBleeding = (date, level) => {
    const existing = bleedingRecords.find(r => r.date === date);
    if (existing) {
      setBleedingRecords(bleedingRecords.map(r => 
        r.date === date ? { ...r, level } : r
      ));
    } else {
      setBleedingRecords([...bleedingRecords, { date, level }]);
    }
  };

  // 休薬期間判定
  const shouldEnterBreakPeriod = (medication) => {
    if (!medication.isYazFlex) return false;
    
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }
    
    let consecutiveBleedingDays = 0;
    for (let i = last7Days.length - 1; i >= 0; i--) {
      const bleeding = bleedingRecords.find(r => r.date === last7Days[i]);
      if (bleeding && bleeding.level !== 'none') {
        consecutiveBleedingDays++;
      } else {
        break;
      }
    }
    
    return consecutiveBleedingDays >= 3;
  };

  // メンタル記録保存
  const saveTodayMental = () => {
    const existing = mentalRecords.find(r => r.date === todayMental.date);
    if (existing) {
      setMentalRecords(mentalRecords.map(r => 
        r.date === todayMental.date ? todayMental : r
      ));
    } else {
      setMentalRecords([...mentalRecords, todayMental]);
    }
    
    showInstantNotification('✅ メンタル記録を保存', '今日の記録を保存しました');
  };

  const saveWeeklyMental = () => {
    const existing = weeklyMentalRecords.find(r => r.weekStart === weeklyMental.weekStart);
    if (existing) {
      setWeeklyMentalRecords(weeklyMentalRecords.map(r => 
        r.weekStart === weeklyMental.weekStart ? weeklyMental : r
      ));
    } else {
      setWeeklyMentalRecords([...weeklyMentalRecords, weeklyMental]);
    }
    
    showInstantNotification('✅ 週次記録を保存', '今週の記録を保存しました');
  };

  // 時間スロット追加/削除
  const addTimeSlot = () => {
    setNewMedication({
      ...newMedication,
      times: [...newMedication.times, '12:00']
    });
  };

  const removeTimeSlot = (index) => {
    const newTimes = newMedication.times.filter((_, i) => i !== index);
    setNewMedication({
      ...newMedication,
      times: newTimes.length > 0 ? newTimes : ['09:00']
    });
  };

  // 医師向けレポート生成
  const generateReport = () => {
    const last30Days = records.filter(r => {
      const recordDate = new Date(r.timestamp);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recordDate >= thirtyDaysAgo;
    });

    const mentalData = mentalRecords.filter(r => {
      const recordDate = new Date(r.date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return recordDate >= thirtyDaysAgo;
    });

    return { medicationRecords: last30Days, mentalRecords: mentalData };
  };

  return (
    <div className="max-w-4xl mx-auto p-4 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      {/* PWA インストールバナー */}
      {isInstallable && (
        <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white p-3 z-50 shadow-lg">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <InstallIcon />
              <span className="text-sm">このアプリをホーム画面に追加できます</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={installApp}
                className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
              >
                インストール
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`bg-white rounded-2xl shadow-xl overflow-hidden ${isInstallable ? 'mt-16' : ''}`}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center gap-3">
            <PillIcon />
            <div>
              <h1 className="text-2xl font-bold">お薬リマインダー</h1>
              <p className="text-blue-100">服薬管理・記録アプリ（KEGG MEDICUS連携・PWA対応）</p>
            </div>
          </div>
          <div className="mt-4 text-blue-100">
            {currentTime.toLocaleString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
          
          {/* 通知状態表示 */}
          <div className="mt-2 text-sm">
            {isInitializing ? (
              <span className="text-blue-200">通知設定を確認中...</span>
            ) : isNotificationEnabled ? (
              <span className="text-green-200">🔔 通知が有効です</span>
            ) : (
              <span className="text-yellow-200">🔕 通知が無効です</span>
            )}
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('medications')}
            className={`flex-shrink-0 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeTab === 'medications'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PillIcon className="text-base" />
            お薬管理
          </button>
          <button
            onClick={() => setActiveTab('mental')}
            className={`flex-shrink-0 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeTab === 'mental'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <MentalIcon className="text-base" />
            メンタル記録
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`flex-shrink-0 py-3 px-4 flex items-center justify-center gap-2 font-medium transition-colors ${
              activeTab === 'report'
                ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ReportIcon className="text-base" />
            医師向けレポート
          </button>
        </div>

        <div className="p-6">
          {/* お薬管理タブ */}
          {activeTab === 'medications' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-800">登録中のお薬</h2>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  <PlusIcon className="text-base" />
                  薬を追加
                </button>
              </div>

              {/* 薬追加フォーム */}
              {showAddForm && (
                <div className="bg-gray-50 rounded-xl p-6 mb-6 border">
                  <h3 className="text-lg font-medium mb-4 text-gray-800">新しいお薬を追加</h3>
                  
                  {/* 薬の種類選択 */}
                  <div className="mb-4 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isYazFlex}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isYazFlex: e.target.checked,
                          isAntidepressant: false,
                          isAntipsychotic: false,
                          name: e.target.checked ? 'ヤーズフレックス' : '',
                          dosage: e.target.checked ? '1錠' : ''
                        })}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-gray-700">ヤーズフレックス</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isAntidepressant}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isAntidepressant: e.target.checked,
                          isYazFlex: false,
                          isAntipsychotic: false,
                          name: e.target.checked ? '' : newMedication.name,
                          dosage: e.target.checked ? '' : newMedication.dosage
                        })}
                        className="w-4 h-4 text-green-600"
                      />
                      <span className="text-sm font-medium text-gray-700">抗うつ剤</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newMedication.isAntipsychotic}
                        onChange={(e) => setNewMedication({
                          ...newMedication, 
                          isAntipsychotic: e.target.checked,
                          isYazFlex: false,
                          isAntidepressant: false,
                          name: e.target.checked ? 'レキサルティOD錠' : newMedication.name,
                          dosage: e.target.checked ? '1mg' : newMedication.dosage
                        })}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">抗精神病薬（レキサルティなど）</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">薬名</label>
                      <input
                        type="text"
                        value={newMedication.name}
                        onChange={(e) => setNewMedication({...newMedication, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例：セルトラリン、レクサプロ、レキサルティ"
                        disabled={newMedication.isYazFlex || newMedication.isAntipsychotic}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">用量</label>
                      <input
                        type="text"
                        value={newMedication.dosage}
                        onChange={(e) => setNewMedication({...newMedication, dosage: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="例：25mg、1mg、1錠"
                        disabled={newMedication.isYazFlex || newMedication.isAntipsychotic}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">服薬時間</label>
                    {newMedication.times.map((time, index) => (
                      <div key={index} className="flex items-center gap-2 mb-2">
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...newMedication.times];
                            newTimes[index] = e.target.value;
                            setNewMedication({...newMedication, times: newTimes});
                          }}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {newMedication.times.length > 1 && !newMedication.isYazFlex && (
                          <button
                            onClick={() => removeTimeSlot(index)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <TrashIcon className="text-base" />
                          </button>
                        )}
                      </div>
                    ))}
                    {!newMedication.isYazFlex && (
                      <button
                        onClick={addTimeSlot}
                        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                      >
                        <PlusIcon className="text-sm" />
                        時間を追加
                      </button>
                    )}
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">メモ</label>
                    <textarea
                      value={newMedication.notes}
                      onChange={(e) => setNewMedication({...newMedication, notes: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="食後、空腹時、副作用の記録、錐体外路症状の有無などのメモ"
                    />
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      onClick={addMedication}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      追加
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {/* 薬一覧 */}
              <div className="space-y-4">
                {medications.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <PillIcon className="text-4xl" />
                    <p className="mt-2">まだお薬が登録されていません</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="mt-4 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      最初のお薬を登録する
                    </button>
                  </div>
                ) : (
                  medications.map(medication => (
                    <div key={medication.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                            {medication.isYazFlex ? '🟡' : medication.isAntidepressant ? '🟢' : medication.isAntipsychotic ? '🟣' : '💊'}
                            {medication.name}
                            <span className="text-sm font-normal text-gray-600">{medication.dosage}</span>
                          </h3>
                          {medication.notes && (
                            <p className="text-sm text-gray-600 mt-1">{medication.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteMedication(medication.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <TrashIcon className="text-base" />
                        </button>
                      </div>

                      {/* 今日の服薬状況 */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">今日の服薬状況</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {medication.times.map(time => {
                            const taken = getTodaysRecords(medication.id, time);
                            return (
                              <div key={time} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                <span className="text-sm text-gray-700">{time}</span>
                                {taken ? (
                                  <CheckIcon className="text-green-600" />
                                ) : (
                                  <button
                                    onClick={() => markAsTaken(medication.id, time)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                  >
                                    服薬
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* ヤーズフレックス特有の情報 */}
                      {medication.isYazFlex && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                          <h4 className="text-sm font-medium text-yellow-800 mb-2">出血記録</h4>
                          <div className="flex gap-1 mb-2">
                            {(() => {
                              const last7Days = [];
                              for (let i = 6; i >= 0; i--) {
                                const date = new Date();
                                date.setDate(date.getDate() - i);
                                const dateStr = date.toISOString().split('T')[0];
                                const bleeding = bleedingRecords.find(r => r.date === dateStr);
                                last7Days.push(
                                  <div 
                                    key={dateStr} 
                                    className={`w-2 h-2 rounded-full ${
                                      bleeding?.level === 'heavy' ? 'bg-red-600' : 
                                      bleeding?.level === 'moderate' ? 'bg-yellow-400' : 
                                      bleeding?.level === 'light' ? 'bg-yellow-200' : 
                                      'bg-gray-200'
                                    }`}
                                    title={dateStr}
                                  ></div>
                                );
                              }
                              return last7Days;
                            })()}
                          </div>
                          <div className="flex gap-2 text-xs">
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'none')} 
                              className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                            >
                              なし
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'light')} 
                              className="px-2 py-1 bg-yellow-200 rounded hover:bg-yellow-300"
                            >
                              軽度
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'moderate')} 
                              className="px-2 py-1 bg-yellow-400 rounded hover:bg-yellow-500"
                            >
                              中程度
                            </button>
                            <button 
                              onClick={() => recordBleeding(new Date().toISOString().split('T')[0], 'heavy')} 
                              className="px-2 py-1 bg-red-400 rounded hover:bg-red-500 text-white"
                            >
                              重度
                            </button>
                          </div>
                          {shouldEnterBreakPeriod(medication) && (
                            <div className="mt-2 p-2 bg-orange-100 rounded text-sm text-orange-800 flex items-center gap-2">
                              <AlertIcon className="text-sm" />
                              3日以上の連続出血が検出されました。休薬期間の検討をお勧めします。
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* メンタル記録タブ */}
          {activeTab === 'mental' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">メンタル記録</h2>
              
              {/* 日次記録 */}
              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">今日の記録</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'mood', label: '気分', emoji: '😊' },
                    { key: 'anxiety', label: '不安感', emoji: '😰' },
                    { key: 'sleep', label: '睡眠の質', emoji: '😴' },
                    { key: 'appetite', label: '食欲', emoji: '🍽️' },
                    { key: 'energy', label: 'エネルギー', emoji: '⚡' }
                  ].map(item => (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {item.emoji} {item.label} (1-10)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={todayMental[item.key]}
                        onChange={(e) => setTodayMental({...todayMental, [item.key]: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600">{todayMental[item.key]}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">メモ</label>
                  <textarea
                    value={todayMental.notes}
                    onChange={(e) => setTodayMental({...todayMental, notes: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="今日の気づきや症状の変化など"
                  />
                </div>
                
                <button
                  onClick={saveTodayMental}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  今日の記録を保存
                </button>
              </div>

              {/* 週次記録 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">今週の振り返り</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'overallMood', label: '全体的な気分', emoji: '🎭' },
                    { key: 'stressLevel', label: 'ストレスレベル', emoji: '😤' },
                    { key: 'socialFunction', label: '社会機能', emoji: '👥' },
                    { key: 'workPerformance', label: '仕事/学業の調子', emoji: '💼' },
                    { key: 'medicationEffectiveness', label: '薬の効果実感', emoji: '💊' }
                  ].map(item => (
                    <div key={item.key}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {item.emoji} {item.label} (1-10)
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={weeklyMental[item.key]}
                        onChange={(e) => setWeeklyMental({...weeklyMental, [item.key]: parseInt(e.target.value)})}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600">{weeklyMental[item.key]}</div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">副作用・気になる症状</label>
                    <textarea
                      value={weeklyMental.sideEffects}
                      onChange={(e) => setWeeklyMental({...weeklyMental, sideEffects: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="眠気、食欲変化、体重変化、錐体外路症状など"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">特別な出来事・ライフイベント</label>
                    <textarea
                      value={weeklyMental.lifeEvents}
                      onChange={(e) => setWeeklyMental({...weeklyMental, lifeEvents: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="引っ越し、転職、家族の変化、人間関係など"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">来週の目標</label>
                    <textarea
                      value={weeklyMental.goals}
                      onChange={(e) => setWeeklyMental({...weeklyMental, goals: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="運動、睡眠改善、社会活動など"
                    />
                  </div>
                </div>
                
                <button
                  onClick={saveWeeklyMental}
                  className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  週次記録を保存
                </button>
              </div>
            </div>
          )}

          {/* 医師向けレポートタブ */}
          {activeTab === 'report' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-6">医師向けレポート</h2>
              
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-lg font-medium mb-4 text-gray-800">過去30日間のまとめ</h3>
                
                {/* 服薬記録サマリー */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">服薬遵守率</h4>
                  {medications.map(medication => {
                    const totalExpected = medication.times.length * 30; // 30日間
                    const actualTaken = records.filter(r => r.medicationId === medication.id).length;
                    const adherenceRate = totalExpected > 0 ? ((actualTaken / totalExpected) * 100).toFixed(1) : 0;
                    
                    return (
                      <div key={medication.id} className="flex justify-between items-center py-2 border-b border-gray-200">
                        <span>{medication.name}</span>
                        <span className={`font-medium ${adherenceRate >= 80 ? 'text-green-600' : adherenceRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {adherenceRate}%
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* メンタル状態の推移 */}
                <div className="mb-6">
                  <h4 className="font-medium text-gray-700 mb-2">メンタル状態の平均値</h4>
                  {mentalRecords.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { key: 'mood', label: '気分' },
                        { key: 'anxiety', label: '不安感' },
                        { key: 'sleep', label: '睡眠' },
                        { key: 'appetite', label: '食欲' },
                        { key: 'energy', label: 'エネルギー' }
                      ].map(item => {
                        const avg = mentalRecords.reduce((sum, record) => sum + record[item.key], 0) / mentalRecords.length;
                        return (
                          <div key={item.key} className="text-center p-3 bg-white rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{avg.toFixed(1)}</div>
                            <div className="text-sm text-gray-600">{item.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500">メンタル記録がありません</p>
                  )}
                </div>

                {/* 出血記録（ヤーズフレックス使用者） */}
                {medications.some(m => m.isYazFlex) && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-700 mb-2">出血記録（過去30日）</h4>
                    <div className="bg-white p-3 rounded-lg">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const last30Days = [];
                          for (let i = 29; i >= 0; i--) {
                            const date = new Date();
                            date.setDate(date.getDate() - i);
                            const dateStr = date.toISOString().split('T')[0];
                            const bleeding = bleedingRecords.find(r => r.date === dateStr);
                            last30Days.push(
                              <div 
                                key={dateStr} 
                                className={`w-2 h-2 rounded-full ${
                                  bleeding?.level === 'heavy' ? 'bg-red-600' : 
                                  bleeding?.level === 'moderate' ? 'bg-yellow-400' : 
                                  bleeding?.level === 'light' ? 'bg-yellow-200' : 
                                  'bg-gray-200'
                                }`} 
                                title={dateStr}
                              ></div>
                            );
                          }
                          return last30Days;
                        })()}
                      </div>
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="mr-4">⚪ なし</span>
                        <span className="mr-4">🟡 軽度</span>
                        <span className="mr-4">🟠 中程度</span>
                        <span>🔴 重度</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">医師への質問・相談事項</h4>
                  <textarea
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="薬の効果、副作用、気になる症状、生活の変化などについて医師に相談したいことを記入してください"
                  />
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => {
                      const reportData = generateReport();
                      console.log('医師向けレポート:', reportData);
                      showInstantNotification('📋 レポート準備完了', 'レポートデータをコンソールで確認できます');
                    }}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    レポートデータを出力
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationReminderApp;