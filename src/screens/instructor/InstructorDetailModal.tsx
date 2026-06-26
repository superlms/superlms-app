import React from 'react';
import ScreenSkeleton from '../../components/Skeleton';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import VectorIcon from '../../components/VectorIcon';
import { theme, onThemeChange } from '../../utils/theme';

interface InstructorDetailModalProps {
  visible: boolean;
  instructor: any;
  loading: boolean;
  onClose: () => void;
}

const InstructorDetailModal = ({ visible, instructor, loading, onClose }: InstructorDetailModalProps) => {
  const getGradient = (id: number) => {
    const gradients = [
      ['#6366F1', '#818CF8'],
      ['#EC4899', '#F472B6'],
      ['#F59E0B', '#FCD34D'],
      ['#10B981', '#34D399'],
      ['#3B82F6', '#60A5FA'],
      ['#8B5CF6', '#A78BFA'],
    ];
    return gradients[id % gradients.length];
  };

  const gradient = getGradient(instructor?.id || 1);
  
  // Get display data safely
  const displayName = instructor?.name || 'Loading...';
  const displayEmployeeId = instructor?.employee_id || 'N/A';
  const displayEmail = instructor?.email || 'N/A';
  const displaySubjects = instructor?.subjects || [];
  const displayAvatar = instructor?.avatar;

  console.log('[InstructorDetailModal] Rendering modal, visible:', visible, 'loading:', loading, 'instructor:', instructor?.id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <VectorIcon iconSet="Ionicons" iconName="close" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.modalAvatarWrapper}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.modalAvatar} />
              ) : (
                <LinearGradient colors={gradient} style={styles.modalAvatarFallback}>
                  <Text style={styles.modalInitials}>
                    {displayName
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .substring(0, 2) || 'T'}
                  </Text>
                </LinearGradient>
              )}
            </View>
            <Text style={styles.modalName}>{displayName}</Text>
            <View style={styles.modalSubjectPill}>
              <Text style={styles.modalSubjectText}>
                {displaySubjects.map((s: any) => s.name).join(', ') || 'No subjects'}
              </Text>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loaderContainer}>
                <ScreenSkeleton variant="detail" />
                <Text style={styles.loaderText}>Loading details...</Text>
              </View>
            ) : (
              <>
                {/* Employee ID */}
                <View style={styles.detailRow}>
                  <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                    <VectorIcon iconSet="Ionicons" iconName="id-card-outline" size={18} color={gradient[0]} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Employee ID</Text>
                    <Text style={styles.detailValue}>{displayEmployeeId}</Text>
                  </View>
                </View>

                {/* Email */}
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => Linking.openURL(`mailto:${displayEmail}`)}
                >
                  <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                    <VectorIcon iconSet="Feather" iconName="mail" size={18} color={gradient[0]} />
                  </View>
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={styles.detailValue}>{displayEmail}</Text>
                  </View>
                </TouchableOpacity>

                {/* Phone if available */}
                {instructor?.phone && (
                  <TouchableOpacity
                    style={styles.detailRow}
                    onPress={() => Linking.openURL(`tel:${instructor?.phone}`)}
                  >
                    <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                      <VectorIcon iconSet="Feather" iconName="phone" size={18} color={gradient[0]} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Phone</Text>
                      <Text style={styles.detailValue}>{instructor?.phone}</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Qualification if available */}
                {instructor?.qualification && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                      <VectorIcon iconSet="Ionicons" iconName="school-outline" size={18} color={gradient[0]} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Qualification</Text>
                      <Text style={styles.detailValue}>{instructor?.qualification}</Text>
                    </View>
                  </View>
                )}

                {/* Date of Joining if available */}
                {instructor?.date_of_joining && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                      <VectorIcon iconSet="Ionicons" iconName="calendar-outline" size={18} color={gradient[0]} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Date of Joining</Text>
                      <Text style={styles.detailValue}>{instructor?.date_of_joining}</Text>
                    </View>
                  </View>
                )}

                {/* Location if available */}
                {(instructor?.city || instructor?.state) && (
                  <View style={styles.detailRow}>
                    <View style={[styles.detailIconBox, { backgroundColor: gradient[0] + '18' }]}>
                      <VectorIcon iconSet="Ionicons" iconName="location-outline" size={18} color={gradient[0]} />
                    </View>
                    <View style={styles.detailTextContainer}>
                      <Text style={styles.detailLabel}>Location</Text>
                      <Text style={styles.detailValue}>
                        {[instructor?.city, instructor?.state].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Subjects Section */}
                <View style={styles.subjectsSection}>
                  <View style={styles.sectionHeader}>
                    <View style={[styles.sectionIcon, { backgroundColor: gradient[0] + '18' }]}>
                      <VectorIcon iconSet="Ionicons" iconName="book-outline" size={18} color={gradient[0]} />
                    </View>
                    <Text style={styles.sectionTitle}>Subjects Taught</Text>
                  </View>
                  <View style={styles.subjectsList}>
                    {displaySubjects.length > 0 ? (
                      displaySubjects.map((subject: any, index: number) => (
                        <View key={index} style={[styles.subjectTag, { backgroundColor: gradient[0] + '10', borderColor: gradient[0] + '30' }]}>
                          <Text style={[styles.subjectTagText, { color: gradient[0] }]}>{subject.name}</Text>
                          <Text style={[styles.subjectCode, { color: gradient[0] + '80' }]}>({subject.code})</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.noSubjectsText}>No subjects assigned</Text>
                    )}
                  </View>
                </View>

                {/* Chat Button */}
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    console.log('[InstructorDetailModal] Chat with:', displayEmail);
                    onClose();
                  }}
                  style={styles.modalChatBtnWrapper}
                >
                  <LinearGradient
                    colors={gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.modalChatBtn}
                  >
                    <VectorIcon iconSet="Ionicons" iconName="chatbubble-ellipses" size={18} color="#fff" />
                    <Text style={styles.modalChatBtnText}>Chat with {displayName.split(' ')[0] || 'Instructor'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const __mk_styles = () => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
    padding: 4,
  },
  modalAvatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: theme.colors.card,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  modalAvatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  modalAvatarFallback: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalInitials: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  modalName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  modalSubjectPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalSubjectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
    maxHeight: '70%',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  detailIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  subjectsSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  subjectsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 4,
  },
  subjectTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subjectCode: {
    fontSize: 11,
  },
  noSubjectsText: {
    fontSize: 13,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  modalChatBtnWrapper: {
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 999,
    overflow: 'hidden',
  },
  modalChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  modalChatBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default InstructorDetailModal;

// Themed stylesheets — rebuilt on light/dark toggle.
let styles = __mk_styles();
onThemeChange(() => { styles = __mk_styles(); });
