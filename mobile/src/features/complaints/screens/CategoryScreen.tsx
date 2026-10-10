import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button, Card, PageHeader } from '../../../components/ui';
import { tabs } from '../../../data/civic';
import { styles } from '../styles';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'domain' | 'categories' | 'selectedCategories' | 'setSelectedCategories' | 'setPage'> & Pick<ScreenChrome, 'onContentScroll'>;
export function CategoryScreen({ domain, categories, selectedCategories, setSelectedCategories, setPage, onContentScroll }: Props) {
  return (<>
        <PageHeader title={`Report ${tabs.find(tab => tab.key === domain)?.title.toLowerCase()}`} subtitle="Choose the issue you observed" onBack={() => setPage('tracker')} />
        <ScrollView onScroll={onContentScroll} scrollEventThrottle={16} contentContainerStyle={styles.scroll}>
          <Card style={styles.noteCard}><Text style={styles.noteText}>Choose one concern. AI prepares the observations and complaint text for you.</Text></Card>
          {categories.map((item) => {
            const selected = selectedCategories.includes(item.key);
            return <Pressable key={item.key} onPress={() => setSelectedCategories([item.key])}>
              <Card style={[styles.categoryCard, selected && styles.categorySelected]}><View style={styles.categoryTop}><Text style={styles.categoryEmoji}>{item.emoji}</Text><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.categoryDesc}>{item.description}</Text></View><Text style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? '✓' : ''}</Text></View></Card>
            </Pressable>;
          })}
          <Button title={domain === 'NOISE' ? 'Continue to audio capture →' : 'Continue to camera →'} onPress={() => { if (!selectedCategories.length) setSelectedCategories([categories[0].key]); setPage(domain === 'NOISE' ? 'noise' : 'guidance'); }} />
        </ScrollView>
      </>);
}
