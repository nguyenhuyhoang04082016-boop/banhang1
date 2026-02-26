/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Copy, 
  Check, 
  Target, 
  ShoppingBag, 
  Video, 
  Zap, 
  Layout,
  MessageSquare,
  AlertCircle,
  Clapperboard,
  Image as ImageIcon,
  ArrowRight,
  Loader2
} from 'lucide-react';
import Markdown from 'react-markdown';
import { generateSalesContent, generateStoryboard, generateImage, translateAndRefinePrompt } from './services/geminiService';
import { cn } from './lib/utils';

interface SalesData {
  productName: string;
  price: string;
  highlights: string;
  targetAudience: string;
  platform: string;
  goal: string;
  productImage?: string;
  aspectRatio: '9:16' | '16:9';
}

interface ScriptSegment {
  text: string;
  duration: number;
}

interface SalesResult {
  insight: string;
  hooks: string[];
  scriptSegments: ScriptSegment[];
  cta: string;
  variants: {
    emotional: string;
    humorous: string;
    direct: string;
  };
}

interface StoryboardSegment {
  id: string;
  segmentText: string;
  startPrompt: string;
  endPrompt: string;
  startRequest?: string;
  endRequest?: string;
  startImage?: string;
  endImage?: string;
  isLoadingStart?: boolean;
  isLoadingEnd?: boolean;
  isRefiningStart?: boolean;
  isRefiningEnd?: boolean;
  isVideoGenerating?: boolean;
  videoUrl?: string;
}

const INITIAL_DATA: SalesData = {
  productName: '',
  price: '',
  highlights: '',
  targetAudience: '',
  platform: 'TikTok',
  goal: 'Bán nhanh',
  productImage: '',
  aspectRatio: '9:16',
};

const PLATFORMS = ['TikTok', 'Facebook Ads', 'Shopee', 'Lazada', 'Livestream', 'Landing Page'];
const GOALS = ['Bán nhanh', 'Xây thương hiệu', 'Viral', 'Tăng tương tác'];

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [formData, setFormData] = useState<SalesData>(INITIAL_DATA);
  const [result, setResult] = useState<SalesResult | null>(null);
  const [storyboard, setStoryboard] = useState<StoryboardSegment[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStoryboarding, setIsStoryboarding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  // Check API key on mount
  React.useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelection = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success as per guidelines
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.productName || !formData.highlights) {
      setError("Vui lòng nhập tên sản phẩm và điểm nổi bật.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setStoryboard(null);
    try {
      const content = await generateSalesContent(formData);
      setResult(content);
    } catch (err) {
      setError("Có lỗi xảy ra khi tạo nội dung. Vui lòng thử lại.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, productImage: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateStoryboard = async () => {
    if (!result) return;
    setIsStoryboarding(true);
    try {
      const data = await generateStoryboard(result.scriptSegments, {
        productName: formData.productName,
        highlights: formData.highlights,
        targetAudience: formData.targetAudience,
        productImage: formData.productImage
      });
      const segments = data.segments;
      setStoryboard(segments.map((s: any, idx: number) => ({ 
        ...s, 
        id: `seg-${idx}-${Date.now()}`,
        isLoadingStart: false, 
        isLoadingEnd: false 
      })));
      
      // Auto-generate images for each segment
      for (let i = 0; i < segments.length; i++) {
        updateSegment(i, { isLoadingStart: true, isLoadingEnd: true });

        const [startImg, endImg] = await Promise.all([
          generateImage(segments[i].startPrompt, formData.aspectRatio),
          generateImage(segments[i].endPrompt, formData.aspectRatio)
        ]);

        updateSegment(i, { 
          startImage: startImg || undefined, 
          endImage: endImg || undefined, 
          isLoadingStart: false, 
          isLoadingEnd: false 
        });
      }
    } catch (err) {
      setError("Không thể tạo storyboard. Vui lòng thử lại.");
    } finally {
      setIsStoryboarding(false);
    }
  };

  const updateSegment = (index: number, updates: Partial<StoryboardSegment>) => {
    setStoryboard(prev => {
      if (!prev) return null;
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const updateScriptSegment = (index: number, text: string) => {
    setResult(prev => {
      if (!prev) return null;
      const updated = { ...prev };
      updated.scriptSegments[index].text = text;
      return updated;
    });
  };

  const handleRegenerateFrame = async (index: number, type: 'start' | 'end') => {
    const segment = storyboard?.[index];
    if (!segment) return;

    const isLoadingKey = type === 'start' ? 'isLoadingStart' : 'isLoadingEnd';
    const imageKey = type === 'start' ? 'startImage' : 'endImage';
    const promptKey = type === 'start' ? 'startPrompt' : 'endPrompt';

    updateSegment(index, { [isLoadingKey]: true });
    try {
      const img = await generateImage(segment[promptKey], formData.aspectRatio);
      updateSegment(index, { [imageKey]: img || undefined, [isLoadingKey]: false });
    } catch (err) {
      updateSegment(index, { [isLoadingKey]: false });
    }
  };

  const handleRefinePrompt = async (index: number, type: 'start' | 'end') => {
    const segment = storyboard?.[index];
    if (!segment) return;

    const requestKey = type === 'start' ? 'startRequest' : 'endRequest';
    const promptKey = type === 'start' ? 'startPrompt' : 'endPrompt';
    const isRefiningKey = type === 'start' ? 'isRefiningStart' : 'isRefiningEnd';
    const request = segment[requestKey];

    if (!request) return;

    updateSegment(index, { [isRefiningKey]: true });
    try {
      const newPrompt = await translateAndRefinePrompt(segment[promptKey], request);
      updateSegment(index, { 
        [promptKey]: newPrompt, 
        [isRefiningKey]: false,
        [requestKey]: '' // Clear request after success
      });
      // Automatically regenerate image with new prompt
      handleRegenerateFrame(index, type);
    } catch (err) {
      updateSegment(index, { [isRefiningKey]: false });
    }
  };

  const handleGenerateVideo = async (index: number) => {
    updateSegment(index, { isVideoGenerating: true });
    // Simulation of Veo 3 video generation
    setTimeout(() => {
      updateSegment(index, { 
        isVideoGenerating: false, 
        videoUrl: 'https://www.w3schools.com/html/mov_bbb.mp4' // Placeholder video
      });
    }, 3000);
  };

  const resetForm = () => {
    setFormData(INITIAL_DATA);
    setResult(null);
    setStoryboard(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Sales Assistant <span className="text-indigo-600">Pro</span></h1>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400">Conversion Focused AI</p>
            </div>
          </div>
          <button 
            onClick={resetForm}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
            title="Làm mới"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Section */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200"
            >
              <div className="flex items-center gap-2 mb-6">
                <Layout className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold">Thông tin sản phẩm</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4" /> Tên sản phẩm
                  </label>
                  <input
                    type="text"
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                    placeholder="Ví dụ: Tai nghe chống ồn Sony WH-1000XM5"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Zap className="w-4 h-4" /> Giá bán & Ưu đãi
                  </label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="Ví dụ: 8.990.000đ (Giảm 10% hôm nay)"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" /> Điểm nổi bật (USP)
                  </label>
                  <textarea
                    value={formData.highlights}
                    onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                    placeholder="Nhập các điểm mạnh nhất của sản phẩm..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Ảnh sản phẩm (Tùy chọn)
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-center gap-2 text-slate-500 bg-slate-50/50">
                        <ImageIcon className="w-5 h-5" />
                        <span className="text-sm">Chọn ảnh sản phẩm</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    {formData.productImage && (
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                        <img src={formData.productImage} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setFormData(prev => ({ ...prev, productImage: '' }))}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <RefreshCw className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Khách hàng mục tiêu
                  </label>
                  <input
                    type="text"
                    value={formData.targetAudience}
                    onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                    placeholder="Ví dụ: Dân văn phòng, người yêu âm nhạc..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Video className="w-4 h-4" /> Nền tảng
                    </label>
                    <select
                      value={formData.platform}
                      onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                    >
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <Layout className="w-4 h-4" /> Tỉ lệ
                    </label>
                    <select
                      value={formData.aspectRatio}
                      onChange={(e) => setFormData({ ...formData, aspectRatio: e.target.value as any })}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                    >
                      <option value="9:16">9:16 (TikTok/Reels)</option>
                      <option value="16:9">16:9 (YouTube/FB)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Target className="w-4 h-4" /> Mục tiêu
                  </label>
                  <select
                    value={formData.goal}
                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  >
                    {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2",
                    isLoading ? "bg-indigo-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]"
                  )}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Đang phân tích...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Tạo kịch bản bán hàng
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>

          {/* Output Section */}
          <div className="lg:col-span-8 space-y-8">
            <AnimatePresence mode="wait">
              {!result && !isLoading ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-8 text-center"
                >
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-600">Sẵn sàng hỗ trợ bạn!</h3>
                  <p className="text-slate-400 max-w-xs mt-2">Nhập thông tin sản phẩm bên trái để AI Sales Pro bắt đầu lên kịch bản thực chiến.</p>
                </motion.div>
              ) : isLoading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] bg-white rounded-3xl border border-slate-200 p-8 flex flex-col items-center justify-center"
                >
                  <div className="relative w-20 h-20">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-indigo-600 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-800">Đang "phù phép" nội dung...</h3>
                  <p className="text-center text-sm text-slate-400 mt-2">Phân tích Insight & Tạo kịch bản Viral</p>
                </motion.div>
              ) : (
                <div className="space-y-8">
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-semibold text-slate-600">Kịch bản hoàn tất</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleGenerateStoryboard}
                          disabled={isStoryboarding}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {isStoryboarding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
                          Tạo Storyboard
                        </button>
                      </div>
                    </div>
                    <div className="p-8 space-y-8">
                      <section>
                        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <Target className="w-5 h-5 text-indigo-600" /> 1. Insight khách hàng
                        </h3>
                        <p className="text-slate-600 leading-relaxed">{result.insight}</p>
                      </section>

                      <section>
                        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-indigo-600" /> 2. Hook quảng cáo
                        </h3>
                        <ul className="space-y-2">
                          {result.hooks.map((hook, i) => (
                            <li key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 font-medium">
                              {hook}
                            </li>
                          ))}
                        </ul>
                      </section>

                      <section>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Clapperboard className="w-5 h-5 text-indigo-600" /> 3. Kịch bản video (Có thể chỉnh sửa)
                          </h3>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mỗi đoạn 8 giây</span>
                        </div>
                        <div className="overflow-hidden rounded-2xl border border-slate-200">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">STT</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Lời thoại / Hành động</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider w-24 text-center">Thời lượng</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.scriptSegments.map((segment, i) => (
                                <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                  <td className="px-4 py-3 text-sm font-bold text-slate-400">{i + 1}</td>
                                  <td className="px-4 py-3">
                                    <textarea
                                      value={segment.text}
                                      onChange={(e) => updateScriptSegment(i, e.target.value)}
                                      className="w-full p-2 text-sm text-slate-700 bg-transparent border-0 focus:ring-1 focus:ring-indigo-500 rounded-lg outline-none transition-all resize-none"
                                      rows={2}
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-500 text-center font-mono">{segment.duration}s</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      <section>
                        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <ShoppingBag className="w-5 h-5 text-indigo-600" /> 4. CTA bán hàng
                        </h3>
                        <p className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-900 font-bold">
                          {result.cta}
                        </p>
                      </section>

                      <section>
                        <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                          <RefreshCw className="w-5 h-5 text-indigo-600" /> 5. Biến thể nội dung
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cảm xúc</h4>
                            <p className="text-sm text-slate-600">{result.variants.emotional}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Hài hước</h4>
                            <p className="text-sm text-slate-600">{result.variants.humorous}</p>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Trực diện</h4>
                            <p className="text-sm text-slate-600">{result.variants.direct}</p>
                          </div>
                        </div>
                      </section>
                    </div>
                  </motion.div>

                  {/* Storyboard Section */}
                  <AnimatePresence>
                    {storyboard && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                      >
                        <div className="flex items-center gap-2 px-2">
                          <Clapperboard className="w-6 h-6 text-indigo-600" />
                          <h2 className="text-xl font-bold">Storyboard 8s (Tối ưu cho Veo 3)</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-6">
                          {storyboard.map((segment, idx) => (
                            <motion.div
                              key={segment.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm overflow-hidden"
                            >
                              <div className="flex items-start gap-3 mb-6">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Lời thoại phân đoạn</label>
                                  <textarea
                                    value={segment.segmentText}
                                    onChange={(e) => updateSegment(idx, { segmentText: e.target.value })}
                                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 font-medium italic focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                                    rows={2}
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Start Frame */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Start Frame (0s)</span>
                                    <button 
                                      onClick={() => handleRegenerateFrame(idx, 'start')}
                                      disabled={segment.isLoadingStart}
                                      className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors disabled:opacity-50"
                                      title="Vẽ lại ảnh bắt đầu"
                                    >
                                      <RefreshCw className={cn("w-4 h-4", segment.isLoadingStart && "animate-spin")} />
                                    </button>
                                  </div>
                                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden relative group border border-slate-100">
                                    {segment.isLoadingStart ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
                                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                        <span className="text-[10px] text-indigo-600 font-bold mt-2 uppercase tracking-widest">Regenerating...</span>
                                      </div>
                                    ) : segment.startImage ? (
                                      <img src={segment.startImage} alt="Start" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                        <ImageIcon className="w-8 h-8" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">English Prompt (Read-only)</label>
                                      <p className="text-[10px] text-slate-500 leading-tight italic">{segment.startPrompt}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={segment.startRequest || ''}
                                        onChange={(e) => updateSegment(idx, { startRequest: e.target.value })}
                                        placeholder="Nhập yêu cầu sửa ảnh bằng tiếng Việt..."
                                        className="flex-1 p-2 text-[10px] text-slate-700 bg-white rounded-lg border border-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                      />
                                      <button
                                        onClick={() => handleRefinePrompt(idx, 'start')}
                                        disabled={segment.isRefiningStart || !segment.startRequest}
                                        className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {segment.isRefiningStart ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Sửa
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                {/* End Frame */}
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">End Frame (8s)</span>
                                    <button 
                                      onClick={() => handleRegenerateFrame(idx, 'end')}
                                      disabled={segment.isLoadingEnd}
                                      className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors disabled:opacity-50"
                                      title="Vẽ lại ảnh kết thúc"
                                    >
                                      <RefreshCw className={cn("w-4 h-4", segment.isLoadingEnd && "animate-spin")} />
                                    </button>
                                  </div>
                                  <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden relative group border border-slate-100">
                                    {segment.isLoadingEnd ? (
                                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm">
                                        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                                        <span className="text-[10px] text-indigo-600 font-bold mt-2 uppercase tracking-widest">Regenerating...</span>
                                      </div>
                                    ) : segment.endImage ? (
                                      <img src={segment.endImage} alt="End" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                                        <ImageIcon className="w-8 h-8" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-2">
                                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">English Prompt (Read-only)</label>
                                      <p className="text-[10px] text-slate-500 leading-tight italic">{segment.endPrompt}</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={segment.endRequest || ''}
                                        onChange={(e) => updateSegment(idx, { endRequest: e.target.value })}
                                        placeholder="Nhập yêu cầu sửa ảnh bằng tiếng Việt..."
                                        className="flex-1 p-2 text-[10px] text-slate-700 bg-white rounded-lg border border-slate-200 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                                      />
                                      <button
                                        onClick={() => handleRefinePrompt(idx, 'end')}
                                        disabled={segment.isRefiningEnd || !segment.endRequest}
                                        className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {segment.isRefiningEnd ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                        Sửa
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="mt-6 pt-6 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2 text-indigo-400">
                                  <ArrowRight className="w-4 h-4" />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Seamless Motion Path (8s)</span>
                                </div>
                                
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                  {!hasApiKey ? (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                        <a 
                                          href="https://labs.google/fx/vi/tools/flow" 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest border border-indigo-200 hover:bg-indigo-100 transition-all"
                                        >
                                          <Layout className="w-3 h-3" />
                                          Đăng nhập Veo 3 (Labs)
                                        </a>
                                        <button
                                          onClick={handleOpenKeySelection}
                                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest border border-amber-200 hover:bg-amber-100 transition-all"
                                        >
                                          <Zap className="w-3 h-3" />
                                          Kết nối API Key
                                        </button>
                                      </div>
                                      <a 
                                        href="https://ai.google.dev/gemini-api/docs/billing" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-[9px] text-slate-400 hover:underline"
                                      >
                                        Hướng dẫn thanh toán
                                      </a>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                        <a 
                                          href="https://labs.google/fx/vi/tools/flow" 
                                          target="_blank" 
                                          rel="noreferrer"
                                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-[9px] font-bold uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-all"
                                        >
                                          <Layout className="w-3 h-3" />
                                          Mở Veo 3 Labs
                                        </a>
                                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg border border-green-100">
                                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                          <span className="text-[9px] font-bold text-green-700 uppercase tracking-widest">API Đã kết nối</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {segment.videoUrl ? (
                                    <div className="flex items-center gap-2">
                                      <video src={segment.videoUrl} className="h-10 rounded-lg shadow-sm" controls />
                                      <button 
                                        onClick={() => updateSegment(idx, { videoUrl: undefined })}
                                        className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:text-red-600"
                                      >
                                        Xóa Video
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleGenerateVideo(idx)}
                                      disabled={segment.isVideoGenerating || !segment.startImage || !segment.endImage}
                                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                      {segment.isVideoGenerating ? (
                                        <>
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                          Đang tạo Video Veo 3...
                                        </>
                                      ) : (
                                        <>
                                          <Video className="w-4 h-4" />
                                          Tạo Video Veo 3 (8s)
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400">© 2026 AI Sales Assistant Pro • Built for E-commerce Success</p>
        </div>
      </footer>
    </div>
  );
}
