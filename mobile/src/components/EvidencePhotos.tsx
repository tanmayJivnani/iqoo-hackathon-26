import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Photo, PhotoGuide } from '../features/complaints/types';
import { colors } from '../theme';

export function EvidencePhotos({ photos, guides, large = false, onRetake }: {
  photos: Photo[]; guides: PhotoGuide[]; large?: boolean; onRetake?: (index: number) => void;
}) {
  return <View style={styles.grid}>{photos.map((photo, index) => {
    const label = guides[index]?.badge ?? `Photo ${index + 1}`;
    return <View key={`${photo.uri}-${index}`} style={styles.item}>
      <Image source={{ uri: photo.uri }} style={[styles.photo, large && styles.largePhoto]}
        resizeMode={large ? 'contain' : 'cover'} accessibilityLabel={label} />
      <Text style={styles.caption}>{large ? label : `${index + 1}. ${label}`}</Text>
      {onRetake && <Pressable accessibilityRole="button" accessibilityLabel={`Retake ${label}`} onPress={() => onRetake(index)} hitSlop={8}>
        <Text style={styles.retake}>Retake</Text>
      </Pressable>}
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 8 }, item: { flex: 1, gap: 4 },
  photo: { width: '100%', height: 102, borderRadius: 13, backgroundColor: colors.evidenceBackground },
  largePhoto: { height: 180 }, caption: { color: colors.evidenceCaption, fontSize: 10, fontWeight: '700' },
  retake: { color: colors.danger, fontSize: 10, fontWeight: '700' },
});
