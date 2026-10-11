import { ScrollView, Text, View } from 'react-native';
import { Button, PageHeader } from '../../../components/ui';
import { categoryLabel } from '../../../data/civic';
import { styles } from '../styles';
import { EvidencePhotos } from '../../../components/EvidencePhotos';
import type { ComplaintFlow } from '../../../hooks/useComplaintFlow';
import type { ScreenChrome } from './types';
type Props = Pick<ComplaintFlow, 'domain' | 'category' | 'currentPhotoIndex' | 'currentPhotoGuide' | 'photos' | 'photoGuides' | 'maxEvidencePhotos' | 'openCamera' | 'choosePhotos' | 'setPage'> & Pick<ScreenChrome, 'insets'>;
export function CaptureScreen({ domain, category, currentPhotoIndex, currentPhotoGuide, photos, photoGuides, maxEvidencePhotos, openCamera, choosePhotos, setPage, insets }: Props) {
  return (<>
        <PageHeader title="Pune Fast Complaint" subtitle={categoryLabel(category)} onBack={() => setPage(photos.length ? 'review' : 'guidance')} />
        <ScrollView key={`${domain}-${currentPhotoIndex}`} contentContainerStyle={styles.captureScroll}>
          {photos.length > 0 && <View style={{ gap: 8 }}>
            <Text style={styles.captureEyebrow}>{photos.length === 1 ? 'PHOTO 1 CAPTURED ✓' : 'CAPTURED PHOTOS ✓'}</Text>
            <EvidencePhotos photos={photos} guides={photoGuides} />
          </View>}
          <View style={styles.captureIntro}>
            <Text style={styles.captureEyebrow}>{domain === 'TREES' ? `PHOTO ${currentPhotoIndex + 1} OF 2` : `PHOTO ${currentPhotoIndex + 1}`}</Text>
            <Text style={styles.captureTitle}>{currentPhotoGuide.title}</Text>
            <Text style={styles.captureDescription}>{currentPhotoGuide.instruction}</Text>
          </View>
          <View style={styles.captureIllustration} accessibilityElementsHidden>
            <View style={[styles.frameCorner, styles.frameTopLeft]} /><View style={[styles.frameCorner, styles.frameTopRight]} />
            <Text style={styles.captureIllustrationIcon}>{currentPhotoIndex === 0 ? (domain === 'TREES' ? '🌳' : '📷') : '🔍'}</Text>
            <View style={[styles.frameCorner, styles.frameBottomLeft]} /><View style={[styles.frameCorner, styles.frameBottomRight]} />
          </View>
        </ScrollView>
        <View style={[styles.captureActions, { paddingBottom: insets.bottom + 20 }]}>
          <Button title="Take photo" onPress={() => void openCamera(photos.length >= maxEvidencePhotos ? currentPhotoIndex : null)} />
          <Button title={domain === 'TREES' ? 'Upload photo' : 'Choose existing photos'} onPress={() => void choosePhotos(photos.length >= maxEvidencePhotos ? currentPhotoIndex : null)} secondary />
        </View>
      </>);
}
