import { MenuItem } from '../types';
import { MENU_IMAGES } from './menuImages';

export const menuData: MenuItem[] = [
  // ☕ COFFEE
  { id: 'coffee-1', name: 'Cà phê phin sữa', price: 15000, category: 'Coffee', image: MENU_IMAGES['coffee-1'] },
  { id: 'coffee-2', name: 'Cà phê phin đen', price: 15000, category: 'Coffee', image: MENU_IMAGES['coffee-2'] },
  { id: 'coffee-3', name: 'Cà phê ép sữa', price: 15000, category: 'Coffee', image: MENU_IMAGES['coffee-3'] },
  { id: 'coffee-4', name: 'Cà phê ép đen', price: 15000, category: 'Coffee', image: MENU_IMAGES['coffee-4'] },
  { id: 'coffee-5', name: 'Cà phê sữa đá', price: 18000, category: 'Coffee', image: MENU_IMAGES['coffee-5'] },
  { id: 'coffee-6', name: 'Cà phê đen đá', price: 15000, category: 'Coffee', image: MENU_IMAGES['coffee-6'] },
  { id: 'coffee-7', name: 'Cà phê sữa tươi', price: 20000, category: 'Coffee', image: MENU_IMAGES['coffee-7'] },
  { id: 'coffee-8', name: 'Cà phê muối', price: 25000, category: 'Coffee', image: MENU_IMAGES['coffee-8'] },
  { id: 'coffee-9', name: 'Bạc xỉu đá', price: 18000, category: 'Coffee', image: MENU_IMAGES['coffee-9'] },
  { id: 'coffee-10', name: 'Bạc xỉu nóng', price: 18000, category: 'Coffee', image: MENU_IMAGES['coffee-10'] },
  { id: 'coffee-11', name: 'Bạc xỉu kem', price: 25000, category: 'Coffee', image: MENU_IMAGES['coffee-11'] },
  { id: 'coffee-12', name: 'Cacao đá', price: 20000, category: 'Coffee', image: MENU_IMAGES['coffee-12'] },
  { id: 'coffee-13', name: 'Cacao nóng', price: 20000, category: 'Coffee', image: MENU_IMAGES['coffee-13'] },
  { id: 'coffee-14', name: 'Cacao kem', price: 25000, category: 'Coffee', image: MENU_IMAGES['coffee-14'] },
  { id: 'coffee-15', name: 'Milo dầm', price: 20000, category: 'Coffee', image: MENU_IMAGES['coffee-15'] },

  // 🍵 TRÀ
  { id: 'tea-1', name: 'Chanh đá', price: 15000, category: 'Trà', image: MENU_IMAGES['tea-1'] },
  { id: 'tea-2', name: 'Chanh nóng', price: 15000, category: 'Trà', image: MENU_IMAGES['tea-2'] },
  { id: 'tea-3', name: 'Trà đào đá', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-3'] },
  { id: 'tea-4', name: 'Trà đào nóng', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-4'] },
  { id: 'tea-5', name: 'Trà đào cam sả', price: 30000, category: 'Trà', image: MENU_IMAGES['tea-5'] },
  { id: 'tea-6', name: 'Trà vải đá', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-6'] },
  { id: 'tea-7', name: 'Trà đào tắc', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-7'] },
  { id: 'tea-8', name: 'Trà lipton sữa', price: 25000, category: 'Trà', image: MENU_IMAGES['tea-8'] },
  { id: 'tea-9', name: 'Trà dâu', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-9'] },
  { id: 'tea-10', name: 'Trà ổi', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-10'] },
  { id: 'tea-11', name: 'Trà việt quất', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-11'] },
  { id: 'tea-12', name: 'Trà xoài', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-12'] },
  { id: 'tea-13', name: 'Trà gừng', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-13'] },
  { id: 'tea-14', name: 'Trà gừng lipton', price: 25000, category: 'Trà', image: MENU_IMAGES['tea-14'] },
  { id: 'tea-15', name: 'Trà lipton đá', price: 25000, category: 'Trà', image: MENU_IMAGES['tea-15'] },
  { id: 'tea-16', name: 'Trà lipton nóng', price: 25000, category: 'Trà', image: MENU_IMAGES['tea-16'] },
  { id: 'tea-17', name: 'Trà tắc xí muội', price: 15000, category: 'Trà', image: MENU_IMAGES['tea-17'] },
  { id: 'tea-18', name: 'Trà tắc thái xanh', price: 10000, category: 'Trà', image: MENU_IMAGES['tea-18'] },
  { id: 'tea-19', name: 'Trà chanh nóng', price: 15000, category: 'Trà', image: MENU_IMAGES['tea-19'] },
  { id: 'tea-20', name: 'Trà chanh đá', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-20'] },
  { id: 'tea-21', name: 'Trà trái cây nhiệt đới', price: 20000, category: 'Trà', image: MENU_IMAGES['tea-21'] },

  // 🥛 SỮA CHUA
  { id: 'yogurt-1', name: 'Sữa chua nếp cẩm', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-1'] },
  { id: 'yogurt-2', name: 'Sữa chua việt quất', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-2'] },
  { id: 'yogurt-3', name: 'Sữa chua cam', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-3'] },
  { id: 'yogurt-4', name: 'Sữa chua dâu tây', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-4'] },
  { id: 'yogurt-5', name: 'Sữa chua kiwi', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-5'] },
  { id: 'yogurt-6', name: 'Sữa chua đào', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-6'] },
  { id: 'yogurt-7', name: 'Sữa chua đá', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-7'] },
  { id: 'yogurt-8', name: 'Sữa chua thạch', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-8'] },
  { id: 'yogurt-9', name: 'Sữa chua hạt đác', price: 25000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-9'] },
  { id: 'yogurt-10', name: 'Sữa chua hũ', price: 10000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-10'] },
  { id: 'yogurt-11', name: 'Sữa chua chanh dây', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-11'] },
  { id: 'yogurt-12', name: 'Sữa chua xoài', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-12'] },
  { id: 'yogurt-13', name: 'Sữa chua khoai môn', price: 20000, category: 'Sữa chua', image: MENU_IMAGES['yogurt-13'] },

  // 🧋 TRÀ SỮA
  { id: 'milktea-1', name: 'Trà sữa thái xanh', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-1'] },
  { id: 'milktea-2', name: 'Trà sữa khoai môn', price: 20000, category: 'Trà sữa', image: MENU_IMAGES['milktea-2'] },
  { id: 'milktea-3', name: 'Trà sữa socola', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-3'] },
  { id: 'milktea-4', name: 'Trà sữa bạc hà', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-4'] },
  { id: 'milktea-5', name: 'Trà sữa dâu', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-5'] },
  { id: 'milktea-6', name: 'Trà sữa kem trứng', price: 20000, category: 'Trà sữa', image: MENU_IMAGES['milktea-6'] },
  { id: 'milktea-7', name: 'Trà sữa matcha', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-7'] },
  { id: 'milktea-8', name: 'Matcha trà xanh', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-8'] },
  { id: 'milktea-9', name: 'Matcha latte', price: 20000, category: 'Trà sữa', image: MENU_IMAGES['milktea-9'] },
  { id: 'milktea-10', name: 'Matcha latte kem muối', price: 25000, category: 'Trà sữa', image: MENU_IMAGES['milktea-10'] },
  { id: 'milktea-11', name: 'Sữa tươi trân châu đường đen', price: 15000, category: 'Trà sữa', image: MENU_IMAGES['milktea-11'] },

  // 🥤 SODA
  { id: 'soda-1', name: 'Soda chanh', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-1'] },
  { id: 'soda-2', name: 'Soda bạc hà', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-2'] },
  { id: 'soda-3', name: 'Soda dâu', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-3'] },
  { id: 'soda-4', name: 'Soda việt quất', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-4'] },
  { id: 'soda-5', name: 'Soda biển xanh', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-5'] },
  { id: 'soda-6', name: 'Soda táo xanh', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-6'] },
  { id: 'soda-7', name: 'Soda đào', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-7'] },
  { id: 'soda-8', name: 'Soda dưa lưới', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-8'] },
  { id: 'soda-9', name: 'Soda nho', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-9'] },
  { id: 'soda-10', name: 'Soda cam', price: 20000, category: 'Soda', image: MENU_IMAGES['soda-10'] },

  // 🍹 NƯỚC ÉP
  { id: 'juice-1', name: 'Nước ép ổi', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-1'] },
  { id: 'juice-2', name: 'Nước ép dưa hấu', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-2'] },
  { id: 'juice-3', name: 'Nước ép dứa', price: 25000, category: 'Nước ép', image: MENU_IMAGES['juice-3'] },
  { id: 'juice-4', name: 'Nước ép cam', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-4'] },
  { id: 'juice-5', name: 'Nước ép cà chua', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-5'] },
  { id: 'juice-6', name: 'Nước ép cà rốt', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-6'] },
  { id: 'juice-7', name: 'Nước ép táo', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-7'] },
  { id: 'juice-8', name: 'Nước dừa', price: 20000, category: 'Nước ép', image: MENU_IMAGES['juice-8'] },

  // 🍮 KEM – CHÈ
  { id: 'dessert-1', name: 'Kem plan', price: 18000, category: 'Kem – chè', image: MENU_IMAGES['dessert-1'] },
  { id: 'dessert-2', name: 'Kem ly', price: 15000, category: 'Kem – chè', image: MENU_IMAGES['dessert-2'] },
  { id: 'dessert-3', name: 'Kem trộn', price: 18000, category: 'Kem – chè', image: MENU_IMAGES['dessert-3'] },
  { id: 'dessert-4', name: 'Kem plan trân châu', price: 15000, category: 'Kem – chè', image: MENU_IMAGES['dessert-4'] },
  { id: 'dessert-5', name: 'Chè dưỡng nhan', price: 20000, category: 'Kem – chè', image: MENU_IMAGES['dessert-5'] },

  // 🥜 SNACK
  { id: 'snack-1', name: 'Hạt dưa đỏ', price: 15000, category: 'Hạt', image: MENU_IMAGES['snack-1'] },
  { id: 'snack-2', name: 'Hạt hướng dương', price: 15000, category: 'Hạt', image: MENU_IMAGES['snack-2'] }
];
