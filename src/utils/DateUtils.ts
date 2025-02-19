export class DateUtils {
    static getLocalDateString(date: Date = new Date()): string {
      return date.toISOString().split('T')[0];
    }
  
    static getStartOfDay(date: Date = new Date()): Date {
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);
      return newDate;
    }
  
    static getEndOfDay(date: Date = new Date()): Date {
      const newDate = new Date(date);
      newDate.setHours(23, 59, 59, 999);
      return newDate;
    }
  
    static isValidDate(date: Date | string): boolean {
      const d = date instanceof Date ? date : new Date(date);
      return d instanceof Date && !isNaN(d.getTime());
    }
  
    static isSameDay(date1: Date, date2: Date): boolean {
      return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
      );
    }
  
  static formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  static isToday(date: Date | string): boolean {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    const today = new Date();
    
    // Convert both dates to local timezone midnight
    const todayLocal = new Date(today.toLocaleDateString());
    const dateLocal = new Date(inputDate.toLocaleDateString());
    
    return todayLocal.getTime() === dateLocal.getTime();
  }

  static getLocalMidnight(date: Date | string): Date {
    const inputDate = typeof date === 'string' ? new Date(date) : date;
    return new Date(inputDate.toLocaleDateString());
  }
}
